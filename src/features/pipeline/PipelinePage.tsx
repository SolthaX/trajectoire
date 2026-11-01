import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { clsx } from 'clsx';
import { Building2, CalendarClock } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { CONTACT_STATUSES, JOB_STATUSES, PRIORITIES, type Option } from '../../../shared/constants';
import type { Contact, Job } from '../../../shared/types';
import { Dot, PriorityIcon } from '../../components/badges';
import { FilterBar, FilterSelect, matches, SearchInput } from '../../components/table';
import { Segmented } from '../../components/ui/form';
import { Avatar, Loading, PageHeader } from '../../components/ui/misc';
import { errorMessage, useList, useSave } from '../../lib/api';
import { daysFromToday, fmtDate, fmtRelativeDay, fullName } from '../../lib/format';
import { useContactSheet, useLocalState } from '../../lib/hooks';

const PRIORITY_RANK: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };

interface CardData {
  id: number;
  status: string;
  priority: string;
  render: (dragging?: boolean) => ReactNode;
  open: () => void;
}

function DraggableCard({ card }: { card: CardData }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { status: card.status } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={card.open}
      className={clsx('touch-none outline-none', isDragging && 'opacity-30')}
    >
      {card.render()}
    </div>
  );
}

function Column({ option, cards }: { option: Option; cards: CardData[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: option.value });
  return (
    <div className="flex w-[276px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Dot color={option.color} />
        <span className="text-[12.5px] font-semibold text-ink">{option.label}</span>
        <span className="tabular text-[12px] text-ink-3">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-[140px] flex-1 flex-col gap-2 rounded-xl border p-2 transition-colors',
          isOver ? 'border-accent/50 bg-accent-soft/60' : 'border-transparent bg-surface-2/60',
        )}
      >
        {cards.map((c) => (
          <DraggableCard key={c.id} card={c} />
        ))}
        {cards.length === 0 && <div className="flex flex-1 items-center justify-center text-[12px] text-ink-3">Déposer ici</div>}
      </div>
    </div>
  );
}

function CardShell({ children, dragging }: { children: ReactNode; dragging?: boolean }) {
  return (
    <div
      className={clsx(
        'cursor-grab rounded-lg border border-line bg-surface p-3 shadow-xs transition-[border-color,box-shadow] hover:border-line-strong active:cursor-grabbing',
        dragging && 'rotate-[1.5deg] shadow-md',
      )}
    >
      {children}
    </div>
  );
}

function jobCard(j: Job, navigate: (to: string) => void): CardData {
  return {
    id: j.id,
    status: j.status,
    priority: j.priority,
    open: () => navigate(`/offres/${j.id}`),
    render: (dragging) => {
      const n = j.deadline ? daysFromToday(j.deadline) : null;
      return (
        <CardShell dragging={dragging}>
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-ink">{j.title}</span>
            <PriorityIcon value={j.priority} className="mt-0.5 size-3.5" />
          </div>
          <div className="mt-1 flex items-center gap-1 truncate text-[12px] text-ink-3">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{[j.company_name, j.location].filter(Boolean).join(' · ') || '—'}</span>
          </div>
          {(j.applied_at || (n != null && n >= 0)) && (
            <div className="mt-2 flex items-center gap-1 text-[11.5px] text-ink-3">
              <CalendarClock className="size-3" />
              {j.applied_at && !['a_etudier', 'a_postuler'].includes(j.status) ? (
                <span>Postulé le {fmtDate(j.applied_at)}</span>
              ) : (
                <span className={clsx(n != null && n <= 3 && 'font-medium text-danger')}>Limite {fmtRelativeDay(j.deadline)}</span>
              )}
            </div>
          )}
        </CardShell>
      );
    },
  };
}

function contactCard(c: Contact, open: (id: number) => void): CardData {
  return {
    id: c.id,
    status: c.status,
    priority: c.priority,
    open: () => open(c.id),
    render: (dragging) => {
      const n = c.next_followup ? daysFromToday(c.next_followup) : null;
      return (
        <CardShell dragging={dragging}>
          <div className="flex items-center gap-2">
            <Avatar name={fullName(c)} className="size-6 text-[10px]" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{fullName(c)}</span>
            <PriorityIcon value={c.priority} />
          </div>
          <div className="mt-1 truncate text-[12px] text-ink-3">{[c.role, c.company_name].filter(Boolean).join(' · ') || '—'}</div>
          {c.next_followup && (
            <div className={clsx('mt-2 text-[11.5px]', n != null && n < 0 ? 'font-medium text-danger' : n === 0 ? 'font-medium text-warning-ink' : 'text-ink-3')}>
              Relance {fmtRelativeDay(c.next_followup)}
            </div>
          )}
        </CardShell>
      );
    },
  };
}

export function PipelinePage() {
  const navigate = useNavigate();
  const { open: openContact } = useContactSheet();
  const [kind, setKind] = useLocalState<'offres' | 'contacts'>('pipeline.kind', 'offres');
  const [q, setQ] = useState('');
  const [priority, setPriority] = useLocalState('pipeline.priority', '');
  const [showClosed, setShowClosed] = useLocalState('pipeline.closed', false);
  const [pending, setPending] = useState<Record<number, string>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const jobs = useList('jobs');
  const contacts = useList('contacts');
  const saveJob = useSave('jobs');
  const saveContact = useSave('contacts');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const isJobs = kind === 'offres';
  const statuses: readonly Option[] = isJobs
    ? JOB_STATUSES.filter((s) => showClosed || !['refuse', 'abandonne'].includes(s.value))
    : CONTACT_STATUSES.filter((s) => showClosed || s.value !== 'sans_suite');

  const cards: CardData[] = isJobs
    ? (jobs.data ?? []).filter((j) => (!priority || j.priority === priority) && matches(q, j.title, j.company_name, j.location)).map((j) => jobCard(j, navigate))
    : (contacts.data ?? [])
        .filter((c) => (!priority || c.priority === priority) && matches(q, c.first_name, c.last_name, c.company_name, c.role))
        .map((c) => contactCard(c, openContact));

  const statusOf = (c: CardData) => pending[c.id] ?? c.status;
  const sortCards = (list: CardData[]) => [...list].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = Number(e.active.id);
    const to = e.over?.id ? String(e.over.id) : null;
    const card = cards.find((c) => c.id === id);
    if (!card || !to || statusOf(card) === to) return;
    setPending((p) => ({ ...p, [id]: to }));
    try {
      if (isJobs) await saveJob.mutateAsync({ id, status: to });
      else await saveContact.mutateAsync({ id, status: to });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending((p) => {
        const { [id]: _, ...rest } = p;
        return rest;
      });
    }
  };

  const active = cards.find((c) => c.id === activeId);
  const loading = isJobs ? jobs.isLoading : contacts.isLoading;

  return (
    <>
      <PageHeader title="Pipeline" description="Glissez les cartes d'une colonne à l'autre pour faire avancer vos démarches." />
      <FilterBar>
        <Segmented
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPending({});
          }}
          options={[
            { value: 'offres', label: 'Candidatures' },
            { value: 'contacts', label: 'Contacts' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder={isJobs ? 'Poste, entreprise…' : 'Nom, entreprise…'} />
        <FilterSelect value={priority} onChange={setPriority} options={PRIORITIES} allLabel="Toutes priorités" />
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-2">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />
          Afficher les statuts clos
        </label>
      </FilterBar>
      {loading ? (
        <Loading />
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
            <div className="flex min-h-[60vh] gap-3">
              {statuses.map((s) => (
                <Column key={s.value} option={s} cards={sortCards(cards.filter((c) => statusOf(c) === s.value))} />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>{active ? active.render(true) : null}</DragOverlay>
        </DndContext>
      )}
    </>
  );
}
