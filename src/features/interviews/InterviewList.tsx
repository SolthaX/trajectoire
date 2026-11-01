import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarPlus, MapPin, Phone, Video } from 'lucide-react';
import { useState } from 'react';
import { INTERVIEW_KINDS, INTERVIEW_OUTCOMES, INTERVIEW_STATUSES, labelOf } from '../../../shared/constants';
import type { Interview } from '../../../shared/types';
import { StatusBadge } from '../../components/badges';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/misc';
import { useList } from '../../lib/api';
import { daysFromToday, ensureUrl, fmtRelativeDay } from '../../lib/format';
import { InterviewForm } from './InterviewForm';

export function FormatIcon({ format: f, className = 'size-3.5' }: { format: string; className?: string }) {
  if (f === 'telephone') return <Phone className={className} />;
  if (f === 'sur_site') return <MapPin className={className} />;
  return <Video className={className} />;
}

export function InterviewRow({ iv, onOpen, showCompany = true }: { iv: Interview; onOpen: () => void; showCompany?: boolean }) {
  const d = parseISO(iv.scheduled_at);
  const upcoming = iv.status === 'prevu' && daysFromToday(iv.scheduled_at) >= 0;
  const isLink = /^https?:\/\//i.test(iv.place) || /^(meet|teams|zoom)\./i.test(iv.place);
  return (
    <li>
      <button
        onClick={onOpen}
        className={clsx(
          'flex w-full items-center gap-4 rounded-xl border bg-surface px-4 py-3 text-left shadow-xs transition-colors hover:border-line-strong',
          upcoming ? 'border-line' : 'border-line/70',
          iv.status === 'annule' && 'opacity-55',
        )}
      >
        <div
          className={clsx(
            'flex w-12 shrink-0 flex-col items-center rounded-lg border py-1',
            upcoming ? 'border-accent/30 bg-accent-soft text-accent-ink' : 'border-line bg-surface-2 text-ink-2',
          )}
        >
          <span className="text-[10.5px] font-medium uppercase">{format(d, 'MMM', { locale: fr }).replace('.', '')}</span>
          <span className="tabular text-[17px] leading-tight font-semibold">{format(d, 'd')}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-[13.5px] font-medium text-ink">
              {iv.job_title || iv.company_name || 'Entretien'}
            </span>
            {showCompany && iv.job_title && iv.company_name && <span className="truncate text-[12.5px] text-ink-3">{iv.company_name}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
            <span className="tabular">
              {format(d, 'EEEE HH:mm', { locale: fr })}
              {iv.duration ? ` · ${iv.duration} min` : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <FormatIcon format={iv.format} className="size-3" /> {labelOf(INTERVIEW_KINDS, iv.kind)}
            </span>
            {iv.interviewers && <span className="truncate">avec {iv.interviewers}</span>}
            {upcoming && <span className="font-medium text-accent-ink">{fmtRelativeDay(iv.scheduled_at)}</span>}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {iv.place && isLink && upcoming && (
            <a
              href={ensureUrl(iv.place)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-line px-2 py-1 text-[12px] font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            >
              Rejoindre
            </a>
          )}
          {iv.status === 'passe' ? (
            <StatusBadge options={INTERVIEW_OUTCOMES} value={iv.outcome} />
          ) : (
            <StatusBadge options={INTERVIEW_STATUSES} value={iv.status} />
          )}
        </div>
      </button>
    </li>
  );
}

/** Liste d'entretiens filtrée + ajout. */
export function InterviewList({
  filter,
  defaults,
  showCompany = true,
}: {
  filter: { company_id?: number; job_id?: number; contact_id?: number };
  defaults?: { job_id?: number | null; company_id?: number | null; contact_id?: number | null };
  showCompany?: boolean;
}) {
  const { data = [] } = useList('interviews', filter);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [open, setOpen] = useState(false);
  const sorted = [...data].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-3">{data.length ? `${data.length} entretien${data.length > 1 ? 's' : ''}` : ''}</span>
        <Button
          size="sm"
          icon={<CalendarPlus />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Planifier un entretien
        </Button>
      </div>
      {sorted.length === 0 ? (
        <EmptyState compact title="Aucun entretien" description="Planifiez vos entretiens pour les préparer et suivre les retours." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((iv) => (
            <InterviewRow
              key={iv.id}
              iv={iv}
              showCompany={showCompany}
              onOpen={() => {
                setEditing(iv);
                setOpen(true);
              }}
            />
          ))}
        </ul>
      )}
      <InterviewForm open={open} onOpenChange={setOpen} interview={editing} defaults={{ ...filter, ...defaults }} />
    </div>
  );
}
