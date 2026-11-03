import { CalendarArrowDown, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EVENT_KINDS, EVENT_STATUSES } from '../../../shared/constants';
import type { Attendee, NetworkEvent } from '../../../shared/types';
import { CompanyPicker, ContactPicker } from '../../components/pickers';
import { Button, IconButton } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog, useConfirm } from '../../components/ui/overlay';
import { Avatar } from '../../components/ui/misc';
import { errorMessage, useList, useRemove, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';
import { fullName } from '../../lib/format';
import { downloadIcs, icsFilename } from '../../lib/ics';
import { ContactForm } from '../contacts/ContactForm';

const EMPTY = {
  name: '',
  organizer_id: null as number | null,
  kind: 'afterwork',
  starts_at: '',
  ends_at: '',
  place: '',
  link: '',
  url: '',
  status: 'repere',
  preparation: '',
  debrief: '',
  next_steps: '',
  attendees: [] as Attendee[],
};

function tomorrowAt(hour: string) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hour}`;
}

/** Personnes rencontrées : contacts existants ou créés sur place, avec une note chacun. */
function AttendeesInput({ value, onChange, eventName }: { value: Attendee[]; onChange: (v: Attendee[]) => void; eventName: string }) {
  const { data: contacts = [] } = useList('contacts');
  const [createOpen, setCreateOpen] = useState(false);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const add = (id: number | null) => id && !value.some((a) => a.contact_id === id) && onChange([...value, { contact_id: id, note: '' }]);

  return (
    <div>
      <div className="mb-2 text-[12px] font-medium text-ink-2">Personnes rencontrées{value.length > 0 && ` · ${value.length}`}</div>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {value.map((a, i) => {
            const c = byId.get(a.contact_id);
            const name = c ? fullName(c) : a.contact_name || 'Contact';
            const sub = c ? [c.role, c.company_name].filter(Boolean).join(' · ') : a.contact_sub;
            return (
              <li key={a.contact_id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={name} className="size-7" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{name}</div>
                    {sub && <div className="truncate text-[11.5px] text-ink-3">{sub}</div>}
                  </div>
                </div>
                <Input
                  value={a.note}
                  onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                  placeholder="De quoi avez-vous parlé ?"
                  aria-label={`Note sur ${name}`}
                />
                <IconButton label="Retirer" size="xs" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <X />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <ContactPicker value={null} onChange={add} exclude={value.map((a) => a.contact_id)} placeholder="Ajouter un contact existant…" />
        <Button icon={<UserPlus />} onClick={() => setCreateOpen(true)}>
          Nouveau contact
        </Button>
      </div>
      <ContactForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        source={eventName.trim() ? `Rencontré à ${eventName.trim()}` : 'Événement de networking'}
        onSaved={(c) => add(c.id)}
      />
    </div>
  );
}

export function EventForm({
  open,
  onOpenChange,
  event,
  organizerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event?: NetworkEvent | null;
  organizerId?: number | null;
}) {
  const save = useSave('events');
  const remove = useRemove('events');
  const confirm = useConfirm();
  const { values, set, bind, reset } = useFormState(EMPTY);

  useEffect(() => {
    if (!open) return;
    reset(
      event
        ? {
            name: event.name,
            organizer_id: event.organizer_id,
            kind: event.kind,
            starts_at: event.starts_at,
            ends_at: event.ends_at ?? '',
            place: event.place,
            link: event.link,
            url: event.url,
            status: event.status,
            preparation: event.preparation,
            debrief: event.debrief,
            next_steps: event.next_steps,
            attendees: event.attendees.map((a) => ({ ...a })),
          }
        : { ...EMPTY, starts_at: tomorrowAt('19:00'), organizer_id: organizerId ?? null },
    );
  }, [open, event, organizerId, reset]);

  const valid = !!(values.name.trim() && values.starts_at);

  const submit = async () => {
    if (!valid) return;
    try {
      await save.mutateAsync({
        id: event?.id,
        ...values,
        ends_at: values.ends_at || null,
        attendees: values.attendees.map((a) => ({ contact_id: a.contact_id, note: a.note })),
      });
      toast.success(event ? 'Événement mis à jour' : 'Événement ajouté');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const del = async () => {
    if (!event) return;
    if (!(await confirm({ title: `Supprimer « ${event.name} » ?`, message: 'Les contacts rencontrés sont conservés.', confirmLabel: 'Supprimer', danger: true }))) return;
    await remove.mutateAsync(event.id);
    toast.success('Événement supprimé');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={event ? 'Événement' : 'Nouvel événement'}
      size="xl"
      onSubmit={submit}
      footer={
        <>
          {event && (
            <Button variant="danger-ghost" className="mr-auto" icon={<Trash2 />} onClick={del}>
              Supprimer
            </Button>
          )}
          {event && (
            <Button icon={<CalendarArrowDown />} onClick={() => downloadIcs([event], icsFilename(event.name))}>
              Ajouter au calendrier
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !valid}>
            {event ? 'Enregistrer' : "Ajouter l'événement"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <FormGrid className="content-start">
            <Field label="Nom *" className="sm:col-span-2">
              {(id) => <Input id={id} {...bind('name')} placeholder="ex. Apéro des shifters, Forum de l'X, Petit déjeuner AX…" autoComplete="off" />}
            </Field>
            <Field label="Organisateur" hint="Réseau, école ou entreprise.">
              {(id) => <CompanyPicker id={id} value={values.organizer_id} onChange={(v) => set('organizer_id', v)} />}
            </Field>
            <Field label="Type">{(id) => <Select id={id} {...bind('kind')} options={EVENT_KINDS} />}</Field>
            <Field label="Début *">{(id) => <Input id={id} type="datetime-local" {...bind('starts_at')} />}</Field>
            <Field label="Fin">{(id) => <Input id={id} type="datetime-local" {...bind('ends_at')} />}</Field>
            <Field label="Lieu">{(id) => <Input id={id} {...bind('place')} placeholder="Adresse" />}</Field>
            <Field label="Lien visio">{(id) => <Input id={id} {...bind('link')} placeholder="https://…" />}</Field>
            <Field label="Page de l'événement / inscription" className="sm:col-span-2">
              {(id) => <Input id={id} {...bind('url')} placeholder="https://…" />}
            </Field>
            <Field label="Statut">{(id) => <Select id={id} {...bind('status')} options={EVENT_STATUSES} />}</Field>
          </FormGrid>
          <div className="space-y-4">
            <Field label="Préparation" hint="Qui je veux rencontrer, mon pitch, questions à poser.">
              {(id) => <Textarea id={id} rows={4} {...bind('preparation')} />}
            </Field>
            <Field label="Bilan">{(id) => <Textarea id={id} rows={4} {...bind('debrief')} placeholder="Ce que j'en retiens, impressions…" />}</Field>
            <Field label="Suites à donner">{(id) => <Textarea id={id} rows={2} {...bind('next_steps')} placeholder="Relances, mises en relation promises…" />}</Field>
          </div>
        </div>
        <AttendeesInput value={values.attendees} onChange={(v) => set('attendees', v)} eventName={values.name} />
      </div>
    </Dialog>
  );
}
