import { clsx } from 'clsx';
import { Briefcase, ExternalLink, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CONTRACTS, JOB_STATUSES, PRIORITIES, REMOTE_MODES, labelOf } from '../../../shared/constants';
import type { Job } from '../../../shared/types';
import { PriorityIcon, StatusSelect } from '../../components/badges';
import { DataTable, FilterBar, FilterSelect, matches, SearchInput, type Column } from '../../components/table';
import { Button } from '../../components/ui/button';
import { Segmented } from '../../components/ui/form';
import { EmptyState, Loading, PageHeader } from '../../components/ui/misc';
import { useList, useSave } from '../../lib/api';
import { daysFromToday, ensureUrl, fmtDate, fmtRelativeDay, plural } from '../../lib/format';
import { useLocalState, useNewParam } from '../../lib/hooks';
import { JobForm } from './JobForm';

const PRIORITY_RANK: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
const STATUS_RANK = Object.fromEntries(JOB_STATUSES.map((s, i) => [s.value, i]));
const CLOSED = ['refuse', 'abandonne'];

export function JobsPage() {
  const { data = [], isLoading } = useList('jobs');
  const save = useSave('jobs');
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState('');
  const [scope, setScope] = useLocalState<'actives' | 'toutes'>('jobs.scope', 'actives');
  const [status, setStatus] = useLocalState('jobs.status', '');
  const [priority, setPriority] = useLocalState('jobs.priority', '');
  const [contract, setContract] = useLocalState('jobs.contract', '');
  const [remote, setRemote] = useLocalState('jobs.remote', '');
  useNewParam(() => setFormOpen(true));

  const rows = data.filter(
    (j) =>
      (scope === 'toutes' || !CLOSED.includes(j.status)) &&
      (!status || j.status === status) &&
      (!priority || j.priority === priority) &&
      (!contract || j.contract === contract) &&
      (!remote || j.remote === remote) &&
      matches(q, j.title, j.company_name, j.location, j.description, j.notes),
  );

  const columns: Column<Job>[] = [
    {
      key: 'title',
      header: 'Poste',
      sort: (j) => j.title,
      cell: (j) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ink">{j.title}</span>
            {j.url && (
              <a
                href={ensureUrl(j.url)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded p-0.5 text-ink-3 hover:text-accent-ink"
                aria-label="Voir l'annonce"
                title="Voir l'annonce"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <div className="truncate text-[12px] text-ink-3">{j.company_name ?? 'Entreprise non renseignée'}</div>
        </div>
      ),
      className: 'max-w-[320px]',
    },
    {
      key: 'where',
      header: 'Lieu · contrat',
      sort: (j) => j.location,
      cell: (j) => (
        <span className="text-[12.5px] whitespace-nowrap text-ink-2">
          {[j.location, j.contract, j.remote && labelOf(REMOTE_MODES, j.remote)].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      sort: (j) => STATUS_RANK[j.status],
      cell: (j) => <StatusSelect size="sm" options={JOB_STATUSES} value={j.status} onChange={(v) => save.mutate({ id: j.id, status: v })} />,
    },
    { key: 'priority', header: 'Priorité', sort: (j) => PRIORITY_RANK[j.priority], cell: (j) => <PriorityIcon value={j.priority} /> },
    {
      key: 'dates',
      header: 'Échéance',
      sort: (j) => j.deadline ?? j.applied_at ?? null,
      cell: (j) => {
        if (j.applied_at && !['a_etudier', 'a_postuler'].includes(j.status))
          return <span className="text-[12.5px] whitespace-nowrap text-ink-3">Postulé le {fmtDate(j.applied_at)}</span>;
        if (!j.deadline) return <span className="text-ink-3">—</span>;
        const n = daysFromToday(j.deadline);
        return (
          <span className={clsx('text-[12.5px] whitespace-nowrap', n < 0 ? 'text-ink-3 line-through' : n <= 3 ? 'font-medium text-danger' : 'text-ink-2')}>
            Limite {fmtRelativeDay(j.deadline)}
          </span>
        );
      },
    },
    {
      key: 'created',
      header: 'Ajoutée',
      sort: (j) => j.created_at,
      cell: (j) => <span className="text-[12.5px] whitespace-nowrap text-ink-3">{fmtDate(j.created_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Offres"
        description="Les fiches de poste repérées et l'avancement de vos candidatures."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>
            Nouvelle offre
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title="Aucune offre pour l'instant"
          description="Ajoutez les annonces qui vous intéressent avec leur lien, pour suivre vos candidatures."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>
              Ajouter une offre
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar count={plural(rows.length, 'offre')}>
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: 'actives', label: 'En cours' },
                { value: 'toutes', label: 'Toutes' },
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Poste, entreprise, lieu…" />
            <FilterSelect value={status} onChange={setStatus} options={JOB_STATUSES} allLabel="Tous les statuts" />
            <FilterSelect value={priority} onChange={setPriority} options={PRIORITIES} allLabel="Toutes priorités" />
            <FilterSelect value={contract} onChange={setContract} options={CONTRACTS} allLabel="Tous contrats" />
            <FilterSelect value={remote} onChange={setRemote} options={REMOTE_MODES} allLabel="Télétravail : tous" />
          </FilterBar>
          <DataTable
            rows={rows}
            columns={columns}
            onRowClick={(j) => navigate(`/offres/${j.id}`)}
            initialSort={{ key: 'created', dir: 'desc' }}
            rowClassName={(j) => (CLOSED.includes(j.status) ? 'opacity-55' : undefined)}
            empty={<EmptyState compact title="Aucun résultat" description="Modifiez la recherche ou les filtres." />}
          />
        </>
      )}
      <JobForm open={formOpen} onOpenChange={setFormOpen} onSaved={(j) => navigate(`/offres/${j.id}`)} />
    </>
  );
}
