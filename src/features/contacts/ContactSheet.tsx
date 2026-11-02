import { clsx } from 'clsx';
import { Briefcase, CalendarPlus, Check, Copy, Mail, MoreHorizontal, Pencil, Phone, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { CONTACT_STATUSES, JOB_STATUSES } from '../../../shared/constants';
import type { Contact } from '../../../shared/types';
import { LinkedinIcon, PrioritySelect, StatusBadge, StatusSelect } from '../../components/badges';
import { Button, IconButton } from '../../components/ui/button';
import { Textarea } from '../../components/ui/form';
import { Menu, Sheet, SheetClose, useConfirm } from '../../components/ui/overlay';
import { Avatar, Loading, Section } from '../../components/ui/misc';
import { useItem, useList, useRemove, useSave, useSettings } from '../../lib/api';
import { addDaysISO, daysFromToday, ensureUrl, fmtDate, fmtRelativeDay, fullName, splitList } from '../../lib/format';
import { useContactSheet } from '../../lib/hooks';
import { Timeline } from '../interactions/Timeline';
import { ContactForm } from './ContactForm';
import { InteractionForm } from '../interactions/InteractionForm';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      label={label}
      size="xs"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
    >
      {done ? <Check className="!size-3.5 text-success" /> : <Copy className="!size-3.5" />}
    </IconButton>
  );
}

function Channel({ icon, value, href, external, copyLabel }: { icon: React.ReactNode; value: string; href: string; external?: boolean; copyLabel: string }) {
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2/70">
      <span className="text-ink-3 [&_svg]:size-[15px]">{icon}</span>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-accent-ink hover:underline"
      >
        {value}
      </a>
      <CopyButton value={value} label={copyLabel} />
    </div>
  );
}

function FollowupEditor({ contact }: { contact: Contact }) {
  const save = useSave('contacts');
  const { data: settings } = useSettings();
  const set = (v: string | null) => save.mutate({ id: contact.id, next_followup: v });
  const n = contact.next_followup ? daysFromToday(contact.next_followup) : null;
  const days = settings?.followup_days ?? 7;
  const chips = [
    { label: '+3 j', days: 3 },
    { label: `+${days} j`, days },
    { label: '+2 sem.', days: 14 },
  ].filter((c, i, arr) => arr.findIndex((x) => x.days === c.days) === i);
  return (
    <div
      className={clsx(
        'rounded-xl border p-3',
        n != null && n < 0 ? 'border-danger/30 bg-danger-soft/50' : n === 0 ? 'border-warning-ink/30 bg-warning-soft/60' : 'border-line bg-surface-2/50',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-medium text-ink">Prochaine relance</span>
        {contact.next_followup && (
          <span className={clsx('text-[12.5px]', n != null && n < 0 ? 'font-medium text-danger' : 'text-ink-2')}>
            {fmtRelativeDay(contact.next_followup)}
            {n != null && n < 0 && ' · en retard'}
          </span>
        )}
        <input
          type="date"
          value={contact.next_followup ?? ''}
          onChange={(e) => set(e.target.value || null)}
          className="ml-auto h-7 rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink outline-none focus:border-accent"
          aria-label="Date de prochaine relance"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={() => set(addDaysISO(c.days))}
            className="h-6 rounded-md border border-line bg-surface px-2 text-[12px] font-medium text-ink-2 hover:border-line-strong hover:text-ink"
          >
            {c.label}
          </button>
        ))}
        {contact.next_followup && (
          <button onClick={() => set(null)} className="h-6 rounded-md px-2 text-[12px] text-ink-3 hover:text-ink">
            Aucune relance
          </button>
        )}
      </div>
    </div>
  );
}

function NotesEditor({ contact }: { contact: Contact }) {
  const save = useSave('contacts');
  const [value, setValue] = useState(contact.notes);
  useEffect(() => setValue(contact.notes), [contact.id, contact.notes]);
  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== contact.notes && save.mutate({ id: contact.id, notes: value }, { onSuccess: () => toast.success('Notes enregistrées') })}
      placeholder="Notes sur cette personne (centres d'intérêt, contexte, points communs…)"
      rows={3}
    />
  );
}

function ContactBody({ contact }: { contact: Contact }) {
  const save = useSave('contacts');
  const remove = useRemove('contacts');
  const confirm = useConfirm();
  const { close } = useContactSheet();
  const { data: jobs = [] } = useList('jobs', { contact_id: contact.id });
  const [editOpen, setEditOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const name = fullName(contact);

  const del = async () => {
    if (!(await confirm({ title: `Supprimer ${name} ?`, message: 'Son journal d’échanges est conservé mais détaché.', confirmLabel: 'Supprimer', danger: true }))) return;
    await remove.mutateAsync(contact.id);
    toast.success('Contact supprimé');
    close();
  };

  return (
    <>
      <div className="flex items-start gap-3 border-b border-line px-6 pt-5 pb-4">
        <Avatar name={name} className="size-11 text-[14px]" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-ink">
            {contact.civility && <span className="font-normal text-ink-3">{contact.civility} </span>}
            {name}
          </h2>
          <p className="truncate text-[13px] text-ink-3">
            {contact.role || 'Poste non renseigné'}
            {contact.company_name && contact.company_id && (
              <>
                {' · '}
                <Link to={`/entreprises/${contact.company_id}`} className="text-ink-2 hover:text-accent-ink hover:underline" onClick={close}>
                  {contact.company_name}
                </Link>
              </>
            )}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusSelect options={CONTACT_STATUSES} value={contact.status} onChange={(v) => save.mutate({ id: contact.id, status: v })} />
            <PrioritySelect value={contact.priority} onChange={(v) => save.mutate({ id: contact.id, priority: v })} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Menu
            trigger={
              <IconButton label="Plus d'actions">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: 'Modifier', icon: <Pencil />, onSelect: () => setEditOpen(true) },
              { separator: true, label: '' },
              { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: del },
            ]}
          />
          <SheetClose asChild>
            <IconButton label="Fermer">
              <X />
            </IconButton>
          </SheetClose>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="flex gap-2">
          <Button variant="primary" icon={<CalendarPlus />} onClick={() => setPlanOpen(true)} className="flex-1">
            Planifier un échange
          </Button>
          <Button icon={<Pencil />} onClick={() => setEditOpen(true)}>
            Modifier
          </Button>
        </div>

        <FollowupEditor contact={contact} />

        <Section title="Coordonnées">
          {contact.email || contact.phone || contact.linkedin ? (
            <div className="-mx-2">
              {splitList(contact.email).map((e) => (
                <Channel key={e} icon={<Mail />} value={e} href={`mailto:${e}`} copyLabel="Copier l'email" />
              ))}
              {splitList(contact.phone).map((p) => (
                <Channel key={p} icon={<Phone />} value={p} href={`tel:${p.replace(/\s/g, '')}`} copyLabel="Copier le numéro" />
              ))}
              {contact.linkedin && (
                <Channel
                  icon={<LinkedinIcon />}
                  value={contact.linkedin.replace(/^https?:\/\/(www\.)?/, '')}
                  href={ensureUrl(contact.linkedin)}
                  external
                  copyLabel="Copier le lien"
                />
              )}
            </div>
          ) : (
            <button onClick={() => setEditOpen(true)} className="text-[13px] text-ink-3 hover:text-ink-2">
              Ajouter un email, un téléphone ou un LinkedIn…
            </button>
          )}
          {contact.source && <p className="text-[12.5px] text-ink-3">Origine : {contact.source}</p>}
        </Section>

        <Section title="Notes">
          <NotesEditor contact={contact} />
        </Section>

        {jobs.length > 0 && (
          <Section title="Offres liées">
            <ul className="space-y-1">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    to={`/offres/${j.id}`}
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13px] hover:border-line-strong"
                  >
                    <Briefcase className="size-3.5 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate text-ink">{j.title}</span>
                    <StatusBadge options={JOB_STATUSES} value={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Journal des échanges">
          <Timeline filter={{ contact_id: contact.id }} showContact={false} />
        </Section>

        <p className="text-[11.5px] text-ink-3">
          Ajouté le {fmtDate(contact.created_at, { year: true })} · modifié le {fmtDate(contact.updated_at, { year: true })}
        </p>
      </div>

      <ContactForm open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <InteractionForm open={planOpen} onOpenChange={setPlanOpen} defaults={{ contact_id: contact.id, direction: 'prevu' }} />
    </>
  );
}

/** Panneau contact global, ouvert via ?contact=ID. */
export function ContactSheet() {
  const { id, close } = useContactSheet();
  const { data: contact, isLoading, isError } = useItem('contacts', id);
  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && close()} title="Fiche contact">
      {isLoading ? (
        <Loading />
      ) : isError || !contact ? (
        <div className="p-6 text-[13px] text-ink-3">Contact introuvable.</div>
      ) : (
        <ContactBody contact={contact} />
      )}
    </Sheet>
  );
}
