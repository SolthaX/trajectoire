import { clsx } from 'clsx';
import { Mail, Phone, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { CONTACT_STATUSES, PRIORITIES } from '../../../shared/constants';
import type { Contact } from '../../../shared/types';
import { LinkedinIcon, PriorityIcon, StatusSelect } from '../../components/badges';
import { DataTable, FilterBar, FilterSelect, matches, SearchInput, type Column } from '../../components/table';
import { Button } from '../../components/ui/button';
import { Segmented } from '../../components/ui/form';
import { Avatar, EmptyState, Loading, PageHeader } from '../../components/ui/misc';
import { useList, useSave } from '../../lib/api';
import { daysFromToday, ensureUrl, fmtAgo, fmtRelativeDay, fullName, plural, splitList } from '../../lib/format';
import { useContactSheet, useLocalState, useNewParam } from '../../lib/hooks';
import { ContactForm } from './ContactForm';

const PRIORITY_RANK: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
const STATUS_RANK = Object.fromEntries(CONTACT_STATUSES.map((s, i) => [s.value, i]));

export function ContactsPage() {
  const { data = [], isLoading } = useList('contacts');
  const { data: companies = [] } = useList('companies');
  const save = useSave('contacts');
  const { open } = useContactSheet();
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useLocalState('contacts.status', '');
  const [priority, setPriority] = useLocalState('contacts.priority', '');
  const [company, setCompany] = useLocalState('contacts.company', '');
  const [view, setView] = useLocalState<'tous' | 'relances'>('contacts.view', 'tous');
  useNewParam(() => setFormOpen(true));

  const due = data.filter((c) => c.next_followup && daysFromToday(c.next_followup) <= 0 && c.status !== 'sans_suite');

  const rows = (view === 'relances' ? due : data).filter(
    (c) =>
      (!status || c.status === status) &&
      (!priority || c.priority === priority) &&
      (!company || String(c.company_id) === company) &&
      matches(q, c.first_name, c.last_name, c.email, c.role, c.company_name, c.notes),
  );

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Nom',
      sort: (c) => `${c.last_name} ${c.first_name}`,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={fullName(c)} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{fullName(c)}</div>
            <div className="truncate text-[12px] text-ink-3">{c.role || '—'}</div>
          </div>
        </div>
      ),
      className: 'max-w-[260px]',
    },
    {
      key: 'company',
      header: 'Entreprise',
      sort: (c) => c.company_name ?? null,
      cell: (c) => <span className="truncate text-ink-2">{c.company_name ?? '—'}</span>,
      className: 'max-w-[180px] truncate',
    },
    {
      key: 'channels',
      header: 'Coordonnées',
      cell: (c) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {c.email ? (
            <a href={`mailto:${splitList(c.email)[0]}`} title={splitList(c.email).join(', ')} className="rounded p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <Mail className="size-3.5" />
            </a>
          ) : null}
          {c.phone ? (
            <a href={`tel:${splitList(c.phone)[0].replace(/\s/g, '')}`} title={splitList(c.phone).join(', ')} className="rounded p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <Phone className="size-3.5" />
            </a>
          ) : null}
          {c.linkedin ? (
            <a href={ensureUrl(c.linkedin)} target="_blank" rel="noreferrer" title="LinkedIn" className="rounded p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <LinkedinIcon className="size-3.5" />
            </a>
          ) : null}
          {!c.email && !c.phone && !c.linkedin && <span className="text-ink-3">—</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Avancement',
      sort: (c) => STATUS_RANK[c.status],
      cell: (c) => <StatusSelect size="sm" options={CONTACT_STATUSES} value={c.status} onChange={(v) => save.mutate({ id: c.id, status: v })} />,
    },
    { key: 'priority', header: 'Priorité', sort: (c) => PRIORITY_RANK[c.priority], cell: (c) => <PriorityIcon value={c.priority} /> },
    {
      key: 'followup',
      header: 'Relance',
      sort: (c) => c.next_followup ?? null,
      cell: (c) => {
        if (!c.next_followup) return <span className="text-ink-3">—</span>;
        const n = daysFromToday(c.next_followup);
        return (
          <span className={clsx('text-[12.5px] whitespace-nowrap', n < 0 ? 'font-medium text-danger' : n === 0 ? 'font-medium text-warning-ink' : 'text-ink-2')}>
            {fmtRelativeDay(c.next_followup)}
          </span>
        );
      },
    },
    {
      key: 'last',
      header: 'Dernier échange',
      sort: (c) => c.last_interaction ?? null,
      cell: (c) => <span className="text-[12.5px] whitespace-nowrap text-ink-3">{c.last_interaction ? fmtAgo(c.last_interaction) : '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Les personnes à contacter, leur avancement et vos relances."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>
            Nouveau contact
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Aucun contact pour l'instant"
          description="Ajoutez les personnes clés dans vos entreprises cibles : recruteurs, managers, anciens collègues…"
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>
              Ajouter un contact
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar count={plural(rows.length, 'contact')}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'tous', label: 'Tous' },
                {
                  value: 'relances',
                  label: (
                    <>
                      À relancer
                      {due.length > 0 && <span className="tabular rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">{due.length}</span>}
                    </>
                  ),
                },
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Nom, email, poste…" />
            <FilterSelect value={status} onChange={setStatus} options={CONTACT_STATUSES} allLabel="Tous les avancements" />
            <FilterSelect value={priority} onChange={setPriority} options={PRIORITIES} allLabel="Toutes priorités" />
            <FilterSelect
              value={company}
              onChange={setCompany}
              options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
              allLabel="Toutes les entreprises"
            />
          </FilterBar>
          <DataTable
            key={view}
            rows={rows}
            columns={columns}
            onRowClick={(c) => open(c.id)}
            initialSort={view === 'relances' ? { key: 'followup', dir: 'asc' } : { key: 'priority', dir: 'asc' }}
            rowClassName={(c) => (c.status === 'sans_suite' ? 'opacity-55' : undefined)}
            empty={
              <EmptyState
                compact
                title={view === 'relances' ? 'Aucune relance à faire' : 'Aucun résultat'}
                description={view === 'relances' ? 'Vous êtes à jour.' : 'Modifiez la recherche ou les filtres.'}
              />
            }
          />
        </>
      )}
      <ContactForm open={formOpen} onOpenChange={setFormOpen} onSaved={(c) => open(c.id)} />
    </>
  );
}
