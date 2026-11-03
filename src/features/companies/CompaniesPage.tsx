import { Building2, MapPin, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { COMPANY_KINDS, COMPANY_STATUSES, labelOf, PRIORITIES } from '../../../shared/constants';
import type { Company } from '../../../shared/types';
import { PriorityIcon, ScoreBadge, StatusBadge } from '../../components/badges';
import { DataTable, FilterBar, FilterSelect, matches, SearchInput, type Column } from '../../components/table';
import { Button } from '../../components/ui/button';
import { EmptyState, Loading, PageHeader } from '../../components/ui/misc';
import { useList } from '../../lib/api';
import { fmtAgo, plural } from '../../lib/format';
import { useLocalState, useNewParam } from '../../lib/hooks';
import { CompanyForm } from './CompanyForm';

const PRIORITY_RANK: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };

export function CompaniesPage() {
  const { data = [], isLoading } = useList('companies');
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useLocalState('companies.status', '');
  const [priority, setPriority] = useLocalState('companies.priority', '');
  const [city, setCity] = useLocalState('companies.city', '');
  const [kind, setKind] = useLocalState('companies.kind', '');
  useNewParam(() => setFormOpen(true));

  const cities = useMemo(() => {
    const set = new Set<string>();
    data.forEach((c) => c.locations?.forEach((l) => l.city && set.add(l.city.trim())));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr')).map((c) => ({ value: c, label: c }));
  }, [data]);

  const rows = data.filter(
    (c) =>
      (!status || c.status === status) &&
      (!priority || c.priority === priority) &&
      (!kind || (c.kind || 'entreprise') === kind) &&
      (!city || c.locations?.some((l) => l.city.trim() === city)) &&
      matches(q, c.name, c.sector, c.description, c.locations?.map((l) => `${l.label} ${l.city}`).join(' ')),
  );

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Entreprise',
      sort: (c) => c.name,
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{c.name}</div>
          {(c.sector || (c.kind && c.kind !== 'entreprise') || c.member) && (
            <div className="truncate text-[12px] text-ink-3">
              {[c.kind && c.kind !== 'entreprise' ? labelOf(COMPANY_KINDS, c.kind) : '', c.sector, c.member ? `j'en fais partie${c.my_role ? ` (${c.my_role})` : ''}` : '']
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
      ),
      className: 'max-w-[260px]',
    },
    { key: 'status', header: 'Statut', sort: (c) => c.status, cell: (c) => <StatusBadge options={COMPANY_STATUSES} value={c.status} /> },
    {
      key: 'priority',
      header: 'Priorité',
      sort: (c) => PRIORITY_RANK[c.priority],
      cell: (c) => <PriorityIcon value={c.priority} />,
    },
    {
      key: 'locations',
      header: 'Localisations',
      cell: (c) =>
        c.locations?.length ? (
          <span className="inline-flex items-center gap-1 text-ink-2">
            <MapPin className="size-3.5 text-ink-3" />
            <span className="truncate">{[...new Set(c.locations.map((l) => l.city || l.label))].join(', ')}</span>
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
      className: 'max-w-[220px] truncate',
    },
    {
      key: 'score',
      header: 'Meilleur projet',
      sort: (c) => c.best_score ?? null,
      cell: (c) => <ScoreBadge score={c.best_score} />,
    },
    {
      key: 'counts',
      header: 'Suivi',
      sort: (c) => (c.projects_count ?? 0) + (c.contacts_count ?? 0) + (c.jobs_count ?? 0),
      cell: (c) => (
        <span className="tabular text-[12.5px] whitespace-nowrap text-ink-2">
          {plural(c.projects_count ?? 0, 'projet')} · {plural(c.contacts_count ?? 0, 'contact')} · {plural(c.jobs_count ?? 0, 'offre')}
        </span>
      ),
    },
    {
      key: 'activity',
      header: 'Dernier échange',
      sort: (c) => c.last_activity ?? null,
      cell: (c) => <span className="text-[12.5px] whitespace-nowrap text-ink-3">{c.last_activity ? fmtAgo(c.last_activity) : '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Entreprises"
        description="Les entreprises que vous ciblez, vos réseaux et écoles, leurs projets et vos notes."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>
            Nouvelle entreprise
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="Aucune entreprise pour l'instant"
          description="Ajoutez les entreprises qui vous intéressent, puis leurs projets, contacts et offres."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>
              Ajouter une entreprise
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar count={plural(rows.length, 'entreprise')}>
            <SearchInput value={q} onChange={setQ} placeholder="Nom, secteur, ville…" />
            <FilterSelect value={kind} onChange={setKind} options={COMPANY_KINDS} allLabel="Tous les types" />
            <FilterSelect value={status} onChange={setStatus} options={COMPANY_STATUSES} allLabel="Tous les statuts" />
            <FilterSelect value={priority} onChange={setPriority} options={PRIORITIES} allLabel="Toutes priorités" />
            {cities.length > 0 && <FilterSelect value={city} onChange={setCity} options={cities} allLabel="Toutes les villes" />}
          </FilterBar>
          <DataTable
            rows={rows}
            columns={columns}
            onRowClick={(c) => navigate(`/entreprises/${c.id}`)}
            initialSort={{ key: 'priority', dir: 'asc' }}
            rowClassName={(c) => (c.status === 'ecartee' ? 'opacity-55' : undefined)}
            empty={<EmptyState compact title="Aucun résultat" description="Modifiez la recherche ou les filtres." />}
          />
        </>
      )}
      <CompanyForm open={formOpen} onOpenChange={setFormOpen} onSaved={(c) => navigate(`/entreprises/${c.id}`)} />
    </>
  );
}
