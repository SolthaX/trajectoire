import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import {
  Briefcase,
  Building2,
  CalendarClock,
  Columns3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Plus,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { SearchResult } from '../../../shared/types';
import { api } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';

const ICONS: Record<SearchResult['type'], ReactNode> = {
  company: <Building2 />,
  contact: <UserRound />,
  job: <Briefcase />,
  file: <FileText />,
};

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  company: 'Entreprise',
  contact: 'Contact',
  job: 'Offre',
  file: 'Fichier',
};

function Item({ icon, children, onSelect, value, hint }: { icon: ReactNode; children: ReactNode; onSelect: () => void; value: string; hint?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </Command.Item>
  );
}

const groupClass =
  'px-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 150);
  const navigate = useNavigate();
  const { data: results = [] } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get<SearchResult[]>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 0,
  });

  // Résultats asynchrones : on sélectionne le premier pour qu'Entrée l'ouvre directement.
  const [selected, setSelected] = useState('');
  const keyOf = (r: SearchResult) => `${r.type}-${r.id}-${r.title}`;
  useEffect(() => {
    if (debounced && results.length) setSelected(keyOf(results[0]));
  }, [results, debounced]);

  const go = (to: string) => {
    onOpenChange(false);
    setQ('');
    navigate(to);
  };

  const openResult = (r: SearchResult) => {
    if (r.type === 'company') go(`/entreprises/${r.id}`);
    else if (r.type === 'job') go(`/offres/${r.id}`);
    else if (r.type === 'contact') go(`/contacts?contact=${r.id}`);
    else go(`/documents?path=${encodeURIComponent(r.id)}`);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ('');
      }}
      label="Palette de commandes"
      shouldFilter={false}
      value={selected}
      onValueChange={setSelected}
      overlayClassName="anim-overlay fixed inset-0 z-40 bg-[rgb(15_15_14/0.32)] backdrop-blur-[1.5px]"
      contentClassName="anim-dialog fixed top-[14vh] left-1/2 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
    >
      <Command.Input
        value={q}
        onValueChange={setQ}
        placeholder="Rechercher une entreprise, un contact, une offre, un fichier…"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-[14px] text-ink outline-none placeholder:text-ink-3"
      />
      <Command.List className="max-h-[56vh] overflow-y-auto pb-2">
        {debounced && results.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px] text-ink-3">Aucun résultat pour « {debounced} »</div>
        )}
        {results.length > 0 && (
          <Command.Group heading="Résultats" className={groupClass}>
            {results.map((r) => (
              <Item key={keyOf(r)} value={keyOf(r)} icon={ICONS[r.type]} onSelect={() => openResult(r)} hint={TYPE_LABEL[r.type]}>
                {r.title}
                {r.subtitle && <span className="ml-2 text-ink-3">{r.subtitle}</span>}
              </Item>
            ))}
          </Command.Group>
        )}
        {!debounced && (
          <>
            <Command.Group heading="Créer" className={groupClass}>
              <Item value="new-company" icon={<Plus />} onSelect={() => go('/entreprises?new=1')}>
                Nouvelle entreprise
              </Item>
              <Item value="new-contact" icon={<Plus />} onSelect={() => go('/contacts?new=1')}>
                Nouveau contact
              </Item>
              <Item value="new-job" icon={<Plus />} onSelect={() => go('/offres?new=1')}>
                Nouvelle offre
              </Item>
              <Item value="new-interview" icon={<Plus />} onSelect={() => go('/entretiens?new=1')}>
                Nouvel entretien
              </Item>
            </Command.Group>
            <Command.Group heading="Aller à" className={groupClass}>
              <Item value="nav-home" icon={<LayoutDashboard />} onSelect={() => go('/')}>
                Vue d'ensemble
              </Item>
              <Item value="nav-pipeline" icon={<Columns3 />} onSelect={() => go('/pipeline')}>
                Pipeline
              </Item>
              <Item value="nav-companies" icon={<Building2 />} onSelect={() => go('/entreprises')}>
                Entreprises
              </Item>
              <Item value="nav-contacts" icon={<Users />} onSelect={() => go('/contacts')}>
                Contacts
              </Item>
              <Item value="nav-jobs" icon={<Briefcase />} onSelect={() => go('/offres')}>
                Offres
              </Item>
              <Item value="nav-interviews" icon={<CalendarClock />} onSelect={() => go('/entretiens')}>
                Entretiens
              </Item>
              <Item value="nav-templates" icon={<Mail />} onSelect={() => go('/modeles')}>
                Modèles de mails
              </Item>
              <Item value="nav-docs" icon={<FolderOpen />} onSelect={() => go('/documents')}>
                Documents
              </Item>
              <Item value="nav-settings" icon={<Settings />} onSelect={() => go('/parametres')}>
                Paramètres
              </Item>
            </Command.Group>
          </>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
