import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Briefcase,
  Building2,
  CalendarClock,
  Send,
  Columns3,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  Mail,
  Menu as MenuIcon,
  Moon,
  Search,
  Settings,
  Share,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { DashboardData } from '../../../shared/types';
import { ContactSheet } from '../../features/contacts/ContactSheet';
import { api } from '../../lib/api';
import { useLocalState, useTheme } from '../../lib/hooks';
import { isStandalone } from '../../lib/pwa';
import { Kbd, Loading } from '../ui/misc';
import { CommandPalette } from './CommandPalette';
import { InstallButton, SyncDot, SyncIndicator, useAutoSync } from './SyncIndicator';

interface NavItem {
  color?: string;
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
              <span className={clsx('flex', it.color ?? (isActive ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2'))}>{it.icon}</span>
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
        <span className="hidden lg:inline-flex">
          <Kbd>Ctrl K</Kbd>
        </span>
      </button>

      <nav className="flex-1 overflow-y-auto">
        <NavGroup
          onNavigate={onNavigate}
          items={[
            { to: '/', label: "Vue d'ensemble", icon: <LayoutDashboard />, end: true, color: 'text-sky' },
            { to: '/pipeline', label: 'Pipeline', icon: <Columns3 />, color: 'text-saffron' },
          ]}
        />
        <NavGroup
          title="Prospection"
          onNavigate={onNavigate}
          items={[
            { to: '/entreprises', label: 'Entreprises', icon: <Building2 />, color: 'text-tan' },
            { to: '/contacts', label: 'Contacts', icon: <Users />, badge: due, color: 'text-coral' },
            { to: '/offres', label: 'Offres', icon: <Briefcase />, color: 'text-sage' },
            { to: '/a-envoyer', label: 'À envoyer', icon: <Send />, color: 'text-saffron' },
            { to: '/entretiens', label: 'Entretiens', icon: <CalendarClock />, color: 'text-plum' },
            { to: '/networking', label: 'Networking', icon: <Handshake />, color: 'text-coral' },
          ]}
        />
        <NavGroup
          title="Outils"
          onNavigate={onNavigate}
          items={[
            { to: '/modeles', label: 'Modèles de mails', icon: <Mail />, color: 'text-sky' },
            { to: '/documents', label: 'Documents', icon: <FolderOpen />, color: 'text-sage' },
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

/** iPhone, dans Safari : rappelle comment installer l'app (pas d'invite d'installation sur iOS). */
function IosInstallBanner() {
  const [hidden, setHidden] = useLocalState('bandeau-ios-masque', false);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!ios || isStandalone() || hidden) return null;
  return (
    <div className="flex items-start gap-2 border-b border-line bg-saffron-soft px-4 py-2 text-[12.5px] text-ink-2 lg:hidden">
      <Share className="mt-0.5 size-4 shrink-0 text-ink-3" />
      <p className="flex-1">
        Installez Trajectoire : bouton <strong>Partager</strong> puis <strong>Sur l'écran d'accueil</strong>. Ensuite, ouvrez-la depuis son icône et
        connectez-la dans Paramètres.
      </p>
      <button onClick={() => setHidden(true)} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Masquer">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Barre d'onglets en bas de l'écran, sur téléphone. « Plus » ouvre le menu complet. */
function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });
  const due = data?.followups.filter((f) => f.overdue_days >= 0).length ?? 0;
  const tabs = [
    { to: '/', label: 'Accueil', icon: <LayoutDashboard />, end: true },
    { to: '/contacts', label: 'Contacts', icon: <Users />, badge: due },
    { to: '/networking', label: 'Networking', icon: <Handshake /> },
    { to: '/a-envoyer', label: 'À envoyer', icon: <Send /> },
  ];
  const item = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[10.5px] font-medium [&_svg]:size-[21px]';
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navigation principale"
    >
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => clsx(item, isActive && !moreOpen ? 'text-maroon' : 'text-ink-3')}>
          {t.icon}
          {t.label}
          {!!t.badge && (
            <span className="tabular absolute top-0.5 left-1/2 ml-2 rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">{t.badge}</span>
          )}
        </NavLink>
      ))}
      <button onClick={onMore} className={clsx(item, moreOpen ? 'text-maroon' : 'text-ink-3')} aria-expanded={moreOpen}>
        <MenuIcon />
        Plus
      </button>
    </nav>
  );
}

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const fullBleed = location.pathname.startsWith('/documents');
  useAutoSync();

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
          <aside className="anim-sheet absolute inset-y-0 left-0 w-[260px] side border-r border-line bg-bg pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+56px)] text-ink shadow-lg">
            <Sidebar onSearch={() => setPaletteOpen(true)} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-12 w-full items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-6 rounded-md ring-1 ring-line" />
            <span className="text-[14px] font-semibold">Trajectoire</span>
            <span className="ml-auto" />
            <SyncDot />
            <button onClick={() => setPaletteOpen(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2" aria-label="Rechercher">
              <Search className="size-5" />
            </button>
          </div>
        </div>
        <IosInstallBanner />
        <main
          className={clsx(
            'min-h-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+56px)] lg:pb-0',
            fullBleed ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain',
          )}
        >
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

      <TabBar onMore={() => setMobileNav((o) => !o)} moreOpen={mobileNav} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ContactSheet />
    </div>
  );
}
