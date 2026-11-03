import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarPlus, Handshake, Plus, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { COMPANY_KINDS, EVENT_STATUSES, labelOf } from '../../../shared/constants';
import type { NetworkEvent } from '../../../shared/types';
import { FilterSelect } from '../../components/table';
import { Button } from '../../components/ui/button';
import { EmptyState, Loading, PageHeader, Section } from '../../components/ui/misc';
import { useList } from '../../lib/api';
import { daysFromToday, plural } from '../../lib/format';
import { useLocalState, useNewParam } from '../../lib/hooks';
import { CompanyForm } from '../companies/CompanyForm';
import { EventForm } from './EventForm';
import { EventRow, isUpcoming } from './EventList';

function dayLabel(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  const label = format(parseISO(iso), 'EEEE d MMMM', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Réseaux, écoles et entreprises dont je fais partie. */
function MyNetworks() {
  const { data: networks = [] } = useList('companies', { member: 1 });
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  return (
    <Section
      title={`Mes réseaux · ${networks.length}`}
      actions={
        <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setFormOpen(true)}>
          Ajouter un réseau
        </Button>
      }
    >
      {networks.length === 0 ? (
        <button
          onClick={() => setFormOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-4 text-[12.5px] text-ink-3 hover:border-line-strong hover:text-ink-2"
        >
          <UsersRound className="size-4" /> Ajoutez les réseaux dont vous faites partie (Shift Project, AX, association d'anciens…)
        </button>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {networks.map((n) => (
            <Link
              key={n.id}
              to={`/entreprises/${n.id}`}
              className="rounded-xl border border-line border-l-4 border-l-coral bg-surface px-4 py-3 shadow-xs transition-colors hover:border-line-strong hover:border-l-coral"
            >
              <div className="truncate text-[13.5px] font-medium text-ink">{n.name}</div>
              <div className="truncate text-[12.5px] text-ink-2">{n.my_role || labelOf(COMPANY_KINDS, n.kind || 'entreprise')}</div>
              <div className="mt-1 text-[12px] text-ink-3">
                {plural(n.events_count ?? 0, 'événement')} · {plural(n.contacts_count ?? 0, 'contact')}
              </div>
            </Link>
          ))}
        </div>
      )}
      <CompanyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaults={{ kind: 'reseau', member: true }}
        onSaved={(c) => navigate(`/entreprises/${c.id}`)}
      />
    </Section>
  );
}

export function NetworkingPage() {
  const { data = [], isLoading } = useList('events');
  const { data: companies = [] } = useList('companies');
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<NetworkEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [organizer, setOrganizer] = useLocalState('networking.organizer', '');
  const [status, setStatus] = useLocalState('networking.status', '');

  const edit = (ev: NetworkEvent | null) => {
    setEditing(ev);
    setOpen(true);
  };
  useNewParam(() => edit(null));

  // ?event=ID : ouvre l'événement (depuis une fiche contact ou la recherche).
  const eventParam = params.get('event');
  useEffect(() => {
    if (!eventParam || isLoading) return;
    const ev = data.find((e) => String(e.id) === eventParam);
    if (ev) edit(ev);
    setParams(
      (p) => {
        p.delete('event');
        return p;
      },
      { replace: true },
    );
  }, [eventParam, isLoading, data, setParams]);

  const organizers = companies
    .filter((c) => data.some((e) => e.organizer_id === c.id))
    .map((c) => ({ value: String(c.id), label: c.name }));
  const rows = data.filter((e) => (!organizer || String(e.organizer_id) === organizer) && (!status || e.status === status));
  const upcoming = rows.filter(isUpcoming).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = rows.filter((e) => !isUpcoming(e)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const groups: { day: string; items: NetworkEvent[] }[] = [];
  for (const ev of upcoming) {
    const day = ev.starts_at.slice(0, 10);
    const g = groups.find((x) => x.day === day);
    if (g) g.items.push(ev);
    else groups.push({ day, items: [ev] });
  }

  return (
    <>
      <PageHeader
        title="Networking"
        description="Vos réseaux, les événements à ne pas manquer et les personnes rencontrées."
        actions={
          <Button variant="primary" icon={<CalendarPlus />} onClick={() => edit(null)}>
            Nouvel événement
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="max-w-4xl space-y-8">
          <MyNetworks />

          {data.length === 0 ? (
            <EmptyState
              icon={<Handshake />}
              title="Aucun événement pour l'instant"
              description="Ajoutez les afterworks, conférences, forums et petits déjeuners repérés, puis les personnes que vous y rencontrez."
              action={
                <Button variant="primary" icon={<CalendarPlus />} onClick={() => edit(null)}>
                  Ajouter un événement
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {organizers.length > 0 && <FilterSelect value={organizer} onChange={setOrganizer} options={organizers} allLabel="Tous les organisateurs" />}
                <FilterSelect value={status} onChange={setStatus} options={EVENT_STATUSES} allLabel="Tous les statuts" />
              </div>
              <Section title={`À venir · ${upcoming.length}`}>
                {groups.length === 0 ? (
                  <p className="text-[13px] text-ink-3">Rien de prévu pour l'instant.</p>
                ) : (
                  <div className="space-y-5">
                    {groups.map((g) => (
                      <div key={g.day}>
                        <div className="mb-2 text-[13px] font-medium text-ink">{dayLabel(g.day)}</div>
                        <ul className="space-y-2">
                          {g.items.map((ev) => (
                            <EventRow key={ev.id} ev={ev} onOpen={() => edit(ev)} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
              {past.length > 0 && (
                <Section title={`Passés · ${past.length}`}>
                  <ul className="space-y-2">
                    {past.map((ev) => (
                      <EventRow key={ev.id} ev={ev} onOpen={() => edit(ev)} />
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>
      )}
      <EventForm open={open} onOpenChange={setOpen} event={editing} />
    </>
  );
}
