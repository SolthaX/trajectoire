import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarPlus, MapPin, Users, Video } from 'lucide-react';
import { useState } from 'react';
import { EVENT_KINDS, EVENT_STATUSES, labelOf } from '../../../shared/constants';
import type { NetworkEvent } from '../../../shared/types';
import { StatusSelect } from '../../components/badges';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/misc';
import { useList, useSave } from '../../lib/api';
import { daysFromToday, ensureUrl, fmtRelativeDay, todayISO } from '../../lib/format';
import { EventForm } from './EventForm';

/** À venir : pas encore passé et ni annulé ni manqué. */
export function isUpcoming(ev: NetworkEvent) {
  return ['repere', 'inscrit'].includes(ev.status) && ev.starts_at.slice(0, 10) >= todayISO();
}

export function EventRow({ ev, onOpen, showOrganizer = true }: { ev: NetworkEvent; onOpen: () => void; showOrganizer?: boolean }) {
  const save = useSave('events');
  const d = parseISO(ev.starts_at);
  const upcoming = isUpcoming(ev);
  const muted = ['annule', 'pas_alle'].includes(ev.status);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
        className={clsx(
          'flex w-full cursor-pointer items-center gap-4 rounded-xl border bg-surface px-4 py-3 text-left shadow-xs transition-colors hover:border-line-strong',
          upcoming ? 'border-line' : 'border-line/70',
          muted && 'opacity-55',
        )}
      >
        <div
          className={clsx(
            'flex w-12 shrink-0 flex-col items-center rounded-lg border py-1',
            upcoming ? 'border-coral/40 bg-coral-soft text-ink' : 'border-line bg-surface-2 text-ink-2',
          )}
        >
          <span className="text-[10.5px] font-medium uppercase">{format(d, 'MMM', { locale: fr }).replace('.', '')}</span>
          <span className="tabular text-[17px] leading-tight font-semibold">{format(d, 'd')}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-[13.5px] font-medium text-ink">{ev.name}</span>
            {showOrganizer && ev.organizer_name && <span className="truncate text-[12.5px] text-ink-3">{ev.organizer_name}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
            <span className="tabular">{format(d, 'EEEE HH:mm', { locale: fr })}</span>
            <span>{labelOf(EVENT_KINDS, ev.kind)}</span>
            {ev.place && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3" /> <span className="truncate">{ev.place}</span>
              </span>
            )}
            {ev.link && !ev.place && (
              <span className="inline-flex items-center gap-1">
                <Video className="size-3" /> en ligne
              </span>
            )}
            {ev.attendees.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {ev.attendees.length} rencontré{ev.attendees.length > 1 ? 's' : ''}
              </span>
            )}
            {upcoming && <span className="font-medium text-ink-2">{fmtRelativeDay(ev.starts_at)}</span>}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {upcoming && ev.status === 'repere' && ev.url && (
            <a
              href={ensureUrl(ev.url)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-line px-2 py-1 text-[12px] font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            >
              S'inscrire
            </a>
          )}
          {upcoming && ev.link && daysFromToday(ev.starts_at) === 0 && (
            <a
              href={ensureUrl(ev.link)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-line px-2 py-1 text-[12px] font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            >
              Rejoindre
            </a>
          )}
          <StatusSelect size="sm" options={EVENT_STATUSES} value={ev.status} onChange={(v) => save.mutate({ id: ev.id, status: v })} />
        </div>
      </div>
    </li>
  );
}

/** Événements d'un organisateur (page entreprise) + ajout. */
export function EventList({ organizerId }: { organizerId: number }) {
  const { data = [] } = useList('events', { organizer_id: organizerId });
  const [editing, setEditing] = useState<NetworkEvent | null>(null);
  const [open, setOpen] = useState(false);
  const upcoming = data.filter(isUpcoming).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = data.filter((e) => !isUpcoming(e));
  const edit = (ev: NetworkEvent | null) => {
    setEditing(ev);
    setOpen(true);
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-3">{data.length ? `${data.length} événement${data.length > 1 ? 's' : ''}` : ''}</span>
        <Button size="sm" icon={<CalendarPlus />} onClick={() => edit(null)}>
          Ajouter un événement
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState compact title="Aucun événement" description="Ajoutez les événements organisés ici : afterworks, conférences, forums…" />
      ) : (
        <ul className="space-y-2">
          {[...upcoming, ...past].map((ev) => (
            <EventRow key={ev.id} ev={ev} showOrganizer={false} onOpen={() => edit(ev)} />
          ))}
        </ul>
      )}
      <EventForm open={open} onOpenChange={setOpen} event={editing} organizerId={organizerId} />
    </div>
  );
}
