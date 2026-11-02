import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Briefcase,
  Building2,
  CalendarClock,
  Send,
  Columns3,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Menu as MenuIcon,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { DashboardData } from '../../../shared/types';
import { ContactSheet } from '../../features/contacts/ContactSheet';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/hooks';
import { Kbd, Loading } from '../ui/misc';
import { CommandPalette } from './CommandPalette';
import { InstallButton, SyncIndicator } from './SyncIndicator';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  end?: boolean;
}

function NavGroup({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-0.5">
      {title && <div className="px-2.5 pt-4 pb-1.5 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{title}</div>}
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors [&_svg]:size-[16px]',
              isActive ? 'bg-surface text-ink shadow-xs ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2/80 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className={clsx('flex', isActive ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2')}>{it.icon}</span>
              <span className="flex-1 truncate">{it.label}</span>
              {!!it.badge && (
                <span
                  className="tabular rounded-full bg-danger-soft px-1.5 text-[11px] leading-[18px] font-semibold text-danger"
                  title={`${it.badge} relance(s) à faire`}
                >
                  {it.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

function Sidebar({ onSearch, onNavigate }: { onSearch: () => void; onNavigate?: () => void }) {
  const { dark, toggle } = useTheme();
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });
  const due = data?.followups.filter((f) => f.overdue_days >= 0).length ?? 0;

  return (
    <div className="flex h-full flex-col px-3 pt-4 pb-3">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-7 rounded-lg ring-1 ring-line" />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-ink">Trajectoire</div>
          <div className="text-[11.5px] text-ink-3">Recherche d'emploi</div>
        </div>
      </div>

      <button
        onClick={onSearch}
        className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink-3 shadow-xs transition-colors hover:border-line-strong hover:text-ink-2"
      >
        <Search className="size-[15px]" />
        <span className="flex-1 text-left">Rechercher…</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      <nav className="flex-1 overflow-y-auto">
        <NavGroup
          onNavigate={onNavigate}
          items={[
            { to: '/', label: "Vue d'ensemble", icon: <LayoutDashboard />, end: true },
            { to: '/pipeline', label: 'Pipeline', icon: <Columns3 /> },
          ]}
        />
        <NavGroup
          title="Prospection"
          onNavigate={onNavigate}
          items={[
            { to: '/entreprises', label: 'Entreprises', icon: <Building2 /> },
            { to: '/contacts', label: 'Contacts', icon: <Users />, badge: due },
            { to: '/offres', label: 'Offres', icon: <Briefcase /> },
            { to: '/a-envoyer', label: 'À envoyer', icon: <Send /> },
            { to: '/entretiens', label: 'Entretiens', icon: <CalendarClock /> },
          ]}
        />
        <NavGroup
          title="Outils"
          onNavigate={onNavigate}
          items={[
            { to: '/modeles', label: 'Modèles de mails', icon: <Mail /> },
            { to: '/documents', label: 'Documents', icon: <FolderOpen /> },
          ]}
        />
      </nav>

      <InstallButton />
      <SyncIndicator />
      <div className="mt-1 flex items-center gap-1 border-t border-line pt-2">
        <NavLink
          to="/parametres"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex h-8 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium [&_svg]:size-[16px]',
              isActive ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <Settings className="text-ink-3" /> Paramètres
        </NavLink>
        <button
          onClick={toggle}
          className="flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
          title={dark ? 'Thème clair' : 'Thème sombre'}
        >
          {dark ? <Sun className="size-[16px]" /> : <Moon className="size-[16px]" />}
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const fullBleed = location.pathname.startsWith('/documents');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="hidden w-[232px] shrink-0 side border-r border-line bg-bg text-ink lg:block">
        <Sidebar onSearch={() => setPaletteOpen(true)} />
      </aside>

      {/* navigation mobile */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <aside className="anim-sheet absolute inset-y-0 left-0 w-[260px] side border-r border-line bg-bg text-ink shadow-lg">
            <Sidebar onSearch={() => setPaletteOpen(true)} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-2 border-b border-line px-4 lg:hidden">
          <button
            onClick={() => setMobileNav((o) => !o)}
            className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2"
            aria-label="Menu"
          >
            {mobileNav ? <X className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
          <span className="text-[14px] font-semibold">Trajectoire</span>
          <button onClick={() => setPaletteOpen(true)} className="ml-auto rounded-md p-1.5 text-ink-2 hover:bg-surface-2" aria-label="Rechercher">
            <Search className="size-5" />
          </button>
        </div>
        <main className={clsx('min-h-0 flex-1', fullBleed ? 'overflow-hidden' : 'overflow-y-auto')}>
          <Suspense fallback={<Loading />}>
            {fullBleed ? (
              <Outlet />
            ) : (
              <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
                <Outlet />
              </div>
            )}
          </Suspense>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ContactSheet />
    </div>
  );
}
