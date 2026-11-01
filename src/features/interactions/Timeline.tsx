import { clsx } from 'clsx';
import { ArrowDownLeft, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { INTERACTION_TYPES, labelOf } from '../../../shared/constants';
import type { Interaction } from '../../../shared/types';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/misc';
import { useList } from '../../lib/api';
import { fmtDate, fmtTime } from '../../lib/format';
import { useContactSheet } from '../../lib/hooks';
import { InteractionForm } from './InteractionForm';
import { InteractionIcon } from './InteractionIcon';

function Entry({ it, onEdit, showContact, showCompany }: { it: Interaction; onEdit: () => void; showContact: boolean; showCompany: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { open } = useContactSheet();
  const long = it.content.length > 280 || it.content.split('\n').length > 5;
  const incoming = it.direction === 'entrant';
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute top-8 bottom-0 left-[13px] w-px bg-line group-last:hidden" aria-hidden />
      <span
        className={clsx(
          'relative z-[1] flex size-[27px] shrink-0 items-center justify-center rounded-full border',
          incoming ? 'border-accent/30 bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2',
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
          <button onClick={onEdit} className="ml-auto text-[12px] text-ink-3 opacity-0 group-hover:opacity-100 hover:text-ink focus:opacity-100">
            Modifier
          </button>
        </div>
        {it.subject && <div className="mt-0.5 text-[13px] font-medium text-ink">{it.subject}</div>}
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
}: {
  filter: { contact_id?: number; company_id?: number; job_id?: number };
  defaults?: { contact_id?: number | null; company_id?: number | null; job_id?: number | null };
  showContact?: boolean;
  showCompany?: boolean;
  compactEmpty?: boolean;
}) {
  const { data = [] } = useList('interactions', filter);
  const [editing, setEditing] = useState<Interaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-3">{data.length ? `${data.length} échange${data.length > 1 ? 's' : ''}` : ''}</span>
        <Button
          size="sm"
          icon={<MessageSquarePlus />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Noter un échange
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState
          compact={compactEmpty ?? true}
          title="Aucun échange"
          description="Mails, appels, messages LinkedIn, rendez-vous : gardez une trace de chaque échange."
        />
      ) : (
        <ol>
          {data.map((it) => (
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
      <InteractionForm open={formOpen} onOpenChange={setFormOpen} interaction={editing} defaults={{ ...filter, ...defaults }} />
    </div>
  );
}
