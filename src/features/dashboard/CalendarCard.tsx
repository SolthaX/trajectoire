// Calendrier mensuel du tableau de bord : événements de networking, entretiens, relances, messages et
// calls prévus, échanges faits. Un code couleur par nature, filtrable depuis la légende.

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EVENT_STATUSES, INTERACTION_TYPES, INTERVIEW_KINDS, labelOf } from '../../../shared/constants';
import type { CalendarItem, CalendarKind } from '../../../shared/types';
import { Button, IconButton } from '../../components/ui/button';
import { Card, CardHeader } from '../../components/ui/misc';
import { api } from '../../lib/api';
import { useContactSheet, useLocalState } from '../../lib/hooks';

const KINDS: { kind: CalendarKind; label: string; dot: string; soft: string }[] = [
  { kind: 'evenement', label: 'Networking', dot: 'bg-sky', soft: 'bg-sky-soft' },
  { kind: 'entretien', label: 'Entretiens', dot: 'bg-plum', soft: 'bg-plum-soft' },
  { kind: 'relance', label: 'Relances', dot: 'bg-coral', soft: 'bg-coral-soft' },
  { kind: 'prevu', label: 'Messages prévus', dot: 'bg-saffron', soft: 'bg-saffron-soft' },
  { kind: 'echange', label: 'Échanges', dot: 'bg-sage', soft: 'bg-sage-soft' },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<CalendarKind, (typeof KINDS)[number]>;
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MAX_DOTS = 4;

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

function describe(it: CalendarItem) {
  switch (it.kind) {
    case 'evenement':
      return `Événement · ${labelOf(EVENT_STATUSES, it.status ?? '')}`;
    case 'entretien':
      return `Entretien ${labelOf(INTERVIEW_KINDS, it.detail ?? '')}`;
    case 'relance':
      return 'Relance';
    case 'prevu':
      return `${labelOf(INTERACTION_TYPES, it.detail ?? '')} prévu`;
    case 'echange':
      return `${labelOf(INTERACTION_TYPES, it.detail ?? '')} ${it.status === 'entrant' ? 'reçu' : 'envoyé'}`;
  }
}

export function CalendarCard() {
  const navigate = useNavigate();
  const { open: openContact } = useContactSheet();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => ymd(new Date()));
  const [hidden, setHidden] = useLocalState<CalendarKind[]>('calendrier-masques', []);

  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const from = ymd(gridStart);
  const to = ymd(gridEnd);
  const { data = [] } = useQuery({ queryKey: ['calendar', from, to], queryFn: () => api.get<CalendarItem[]>(`/calendar?from=${from}&to=${to}`) });

  const visible = data.filter((it) => !hidden.includes(it.kind));
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of visible) {
    const d = it.date.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), it]);
  }
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const todayKey = ymd(new Date());

  const goTo = (m: Date) => {
    setMonth(m);
    setSelected(isSameMonth(m, new Date()) ? todayKey : ymd(m));
  };
  const toggle = (k: CalendarKind) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  const open = (it: CalendarItem) => {
    if (it.kind === 'evenement') navigate(`/networking?event=${it.event_id}`);
    else if (it.kind === 'entretien') navigate(it.job_id ? `/offres/${it.job_id}` : '/entretiens');
    else if (it.contact_id) openContact(it.contact_id);
    else if (it.company_id) navigate(`/entreprises/${it.company_id}`);
  };

  const dayItems = byDay.get(selected) ?? [];
  const selectedDate = new Date(`${selected}T12:00:00`);

  return (
    <Card>
      <CardHeader
        title={<span className="first-letter:uppercase">{format(month, 'MMMM yyyy', { locale: fr })}</span>}
        subtitle="Networking, entretiens, relances, messages et échanges"
        actions={
          <div className="flex items-center gap-1">
            {!isSameMonth(month, new Date()) && (
              <Button size="sm" onClick={() => goTo(startOfMonth(new Date()))}>
                Aujourd'hui
              </Button>
            )}
            <IconButton label="Mois précédent" onClick={() => goTo(addMonths(month, -1))}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Mois suivant" onClick={() => goTo(addMonths(month, 1))}>
              <ChevronRight />
            </IconButton>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((k) => {
          const off = hidden.includes(k.kind);
          return (
            <button
              key={k.kind}
              onClick={() => toggle(k.kind)}
              aria-pressed={!off}
              title={off ? 'Afficher' : 'Masquer'}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors',
                off ? 'border-line text-ink-3 line-through' : 'border-line-strong text-ink-2 hover:bg-surface-2',
              )}
            >
              <span className={clsx('size-2 rounded-full', off ? 'bg-surface-3' : k.dot)} />
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-ink-3">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = ymd(d);
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(d, month);
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              aria-label={`${format(d, 'EEEE d MMMM', { locale: fr })} : ${items.length} élément${items.length > 1 ? 's' : ''}`}
              aria-pressed={key === selected}
              className={clsx(
                'flex h-14 flex-col items-center gap-1 rounded-lg border pt-1.5 transition-colors',
                key === selected ? 'border-accent bg-surface-2' : 'border-transparent hover:bg-surface-2/70',
                !inMonth && 'opacity-45',
              )}
            >
              <span
                className={clsx(
                  'tabular flex size-6 items-center justify-center rounded-full text-[12.5px]',
                  key === todayKey ? 'bg-maroon font-semibold text-white' : 'text-ink',
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex max-w-full flex-wrap items-center justify-center gap-0.5 px-0.5">
                {items.slice(0, MAX_DOTS).map((it) => (
                  <span key={it.key} className={clsx('size-[7px] rounded-full', KIND[it.kind].dot)} />
                ))}
                {items.length > MAX_DOTS && <span className="text-[9.5px] leading-none text-ink-3">+{items.length - MAX_DOTS}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase first-letter:uppercase">
          {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
        </div>
        {dayItems.length === 0 ? (
          <p className="py-1 text-[12.5px] text-ink-3">Rien ce jour-là.</p>
        ) : (
          <ul className="-mx-2">
            {dayItems.map((it) => (
              <li key={it.key}>
                <button onClick={() => open(it)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2/80">
                  <span className={clsx('h-8 w-1 shrink-0 rounded-full', KIND[it.kind].dot)} />
                  <span className="tabular w-10 shrink-0 text-[12px] text-ink-3">{it.date.length > 10 ? it.date.slice(11, 16) : ''}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">
                      <span className="font-medium">{it.title}</span>
                      {it.sub && <span className="text-ink-3"> · {it.sub}</span>}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-3">{describe(it)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
