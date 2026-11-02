import { clsx } from 'clsx';
import { ArrowDownLeft, CalendarPlus, Check, Copy, MessageSquarePlus, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Link } from 'react-router';
import { INTERACTION_TYPES, labelOf } from '../../../shared/constants';
import type { Interaction } from '../../../shared/types';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/misc';
import { useList, useSave } from '../../lib/api';
import { ensureUrl, fmtDate, fmtTime, nowLocalISO } from '../../lib/format';
import { useContactSheet } from '../../lib/hooks';
import { InteractionForm } from './InteractionForm';
import { InteractionIcon } from './InteractionIcon';

function Entry({ it, onEdit, showContact, showCompany }: { it: Interaction; onEdit: () => void; showContact: boolean; showCompany: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { open } = useContactSheet();
  const long = it.content.length > 280 || it.content.split('\n').length > 5;
  const incoming = it.direction === 'entrant';
  const planned = it.direction === 'prevu';
  const save = useSave('interactions');
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute top-8 bottom-0 left-[13px] w-px bg-line group-last:hidden" aria-hidden />
      <span
        className={clsx(
          'relative z-[1] flex size-[27px] shrink-0 items-center justify-center rounded-full border',
          planned ? 'border-dashed border-amber-400 bg-surface text-amber-600' : incoming ? 'border-accent/30 bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2',
        )}
      >
        <InteractionIcon type={it.type} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]">
          <span className="font-medium text-ink">
            {labelOf(INTERACTION_TYPES, it.type)}
            {incoming && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11.5px] font-normal text-accent-ink">
                <ArrowDownLeft className="size-3" /> reçu
              </span>
            )}
            {planned && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-px text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">à faire</span>}
          </span>
          {showContact && it.contact_name && it.contact_id && (
            <button onClick={() => open(it.contact_id!)} className="text-ink-2 hover:text-accent-ink hover:underline">
              {it.contact_name}
            </button>
          )}
          {showCompany && it.company_name && it.company_id && (
            <Link to={`/entreprises/${it.company_id}`} className="text-ink-3 hover:text-accent-ink hover:underline">
              {it.company_name}
            </Link>
          )}
          <span className="text-ink-3">
            {fmtDate(it.date)}
            {fmtTime(it.date) && ` · ${fmtTime(it.date)}`}
          </span>
          {planned && (
            <button
              onClick={() => save.mutate({ id: it.id, direction: 'sortant', date: it.date > nowLocalISO() ? nowLocalISO() : it.date })}
              className="ml-auto inline-flex items-center gap-0.5 text-[12px] text-accent-ink hover:underline"
            >
              <Check className="size-3" /> Fait
            </button>
          )}
          <button onClick={onEdit} className={clsx(!planned && 'ml-auto', ' text-[12px] text-ink-3 opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100')}>
            Modifier
          </button>
        </div>
        {it.subject && <div className="mt-0.5 text-[13px] font-medium text-ink">{it.subject}</div>}
        {planned && it.content && (
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(it.content);
              toast.success('Message copié');
            }}
            className="mt-0.5 mr-3 inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline"
          >
            <Copy className="size-3" /> Copier le message
          </button>
        )}
        {it.link && (
          <a href={ensureUrl(it.link)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline">
            <Video className="size-3" /> Rejoindre la visio
          </a>
        )}
        {it.job_title && it.job_id && (
          <Link to={`/offres/${it.job_id}`} className="mt-0.5 inline-block text-[12px] text-ink-3 hover:text-accent-ink">
            Offre : {it.job_title}
          </Link>
        )}
        {it.content && (
          <div className="mt-1">
            <p className={clsx('text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2', !expanded && long && 'line-clamp-4')}>{it.content}</p>
            {long && (
              <button onClick={() => setExpanded((e) => !e)} className="mt-0.5 text-[12px] text-accent-ink hover:underline">
                {expanded ? 'Réduire' : 'Voir tout'}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Journal des échanges filtré (contact, entreprise ou offre). */
export function Timeline({
  filter,
  defaults,
  showContact = true,
  showCompany = false,
  compactEmpty,
  plannedOnly,
}: {
  filter: { contact_id?: number; company_id?: number; job_id?: number };
  defaults?: { contact_id?: number | null; company_id?: number | null; job_id?: number | null };
  showContact?: boolean;
  showCompany?: boolean;
  compactEmpty?: boolean;
  plannedOnly?: boolean;
}) {
  const { data = [] } = useList('interactions', plannedOnly ? { ...filter, direction: 'prevu' } : filter);
  const [editing, setEditing] = useState<Interaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  // Actions prévues en tête, de la plus proche à la plus lointaine.
  const sorted = [...data.filter((i) => i.direction === 'prevu').reverse(), ...data.filter((i) => i.direction !== 'prevu')];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-3">{data.length ? `${data.length} ${plannedOnly ? 'action' : 'échange'}${data.length > 1 ? 's' : ''}${plannedOnly ? ' à faire' : ''}` : ''}</span>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            icon={<CalendarPlus />}
            onClick={() => {
              setEditing(null);
              setPlanMode(true);
              setFormOpen(true);
            }}
          >
            Planifier
          </Button>
          {!plannedOnly && <Button
            size="sm"
            icon={<MessageSquarePlus />}
            onClick={() => {
              setEditing(null);
              setPlanMode(false);
              setFormOpen(true);
            }}
          >
            Noter un échange
          </Button>}
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyState
          compact={compactEmpty ?? true}
          title={plannedOnly ? 'Rien de planifié' : 'Aucun échange'}
          description={plannedOnly ? 'Préparez vos mails, messages LinkedIn, WhatsApp, SMS et calls avec « Planifier ».' : 'Mails, appels, messages LinkedIn, rendez-vous : gardez une trace de chaque échange.'}
        />
      ) : (
        <ol>
          {sorted.map((it) => (
            <Entry
              key={it.id}
              it={it}
              showContact={showContact}
              showCompany={showCompany}
              onEdit={() => {
                setEditing(it);
                setFormOpen(true);
              }}
            />
          ))}
        </ol>
      )}
      <InteractionForm open={formOpen} onOpenChange={setFormOpen} interaction={editing} defaults={{ ...filter, ...defaults, ...(planMode ? { direction: 'prevu' } : {}) }} />
    </div>
  );
}
