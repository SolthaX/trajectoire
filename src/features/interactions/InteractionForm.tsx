import { clsx } from 'clsx';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CONTACT_STATUSES, INTERACTION_TYPES } from '../../../shared/constants';
import type { Interaction } from '../../../shared/types';
import { ContactPicker, JobPicker } from '../../components/pickers';
import { Button } from '../../components/ui/button';
import { Field, FormGrid, Input, Segmented, Select, Textarea } from '../../components/ui/form';
import { Dialog, useConfirm } from '../../components/ui/overlay';
import { api, errorMessage, useList, useRemove, useSave, useSettings } from '../../lib/api';
import { useFormState } from '../../lib/form';
import { addDaysISO, nowLocalISO } from '../../lib/format';
import { InteractionIcon } from './InteractionIcon';

const EMPTY = {
  type: 'email',
  direction: 'sortant',
  date: '',
  subject: '',
  content: '',
  link: '',
  contact_id: null as number | null,
  job_id: null as number | null,
  company_id: null as number | null,
};

/** Statut suggéré pour le contact après un échange. */
export function suggestStatus(current: string, direction: string, type: string) {
  if (type === 'rdv') return 'rdv';
  if (direction === 'entrant') return ['non_contacte', 'contacte', 'relance'].includes(current) ? 'en_contact' : current;
  if (current === 'non_contacte') return 'contacte';
  if (current === 'contacte') return 'relance';
  return current;
}

export function InteractionForm({
  open,
  onOpenChange,
  interaction,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  interaction?: Interaction | null;
  defaults?: { contact_id?: number | null; company_id?: number | null; job_id?: number | null; type?: string; direction?: string };
}) {
  const save = useSave('interactions');
  const remove = useRemove('interactions');
  const confirm = useConfirm();
  const { data: settings } = useSettings();
  const { data: contacts = [] } = useList('contacts');
  const { values, set, bind, reset } = useFormState(EMPTY);
  const [updateContact, setUpdateContact] = useState(true);
  const [nextStatus, setNextStatus] = useState('');
  const [followup, setFollowup] = useState('');

  const contact = contacts.find((c) => c.id === values.contact_id);
  const days = settings?.followup_days ?? 7;
  const planned = values.direction === 'prevu';
  const isCall = values.type === 'appel' || values.type === 'rdv';

  useEffect(() => {
    if (!open) return;
    reset(
      interaction
        ? {
            type: interaction.type,
            direction: interaction.direction,
            date: interaction.date,
            subject: interaction.subject,
            content: interaction.content,
            link: interaction.link ?? '',
            contact_id: interaction.contact_id,
            job_id: interaction.job_id,
            company_id: interaction.company_id,
          }
        : {
            ...EMPTY,
            date: nowLocalISO(),
            type: defaults?.type ?? 'email',
            direction: defaults?.direction ?? 'sortant',
            contact_id: defaults?.contact_id ?? null,
            job_id: defaults?.job_id ?? null,
            company_id: defaults?.company_id ?? null,
          },
    );
    setUpdateContact(true);
  }, [open, interaction, defaults?.contact_id, defaults?.company_id, defaults?.job_id, defaults?.type, defaults?.direction, reset]);

  // Suggestions de mise à jour du contact.
  useEffect(() => {
    if (!contact || interaction) return;
    setNextStatus(suggestStatus(contact.status, values.direction, values.type));
    setFollowup(values.direction === 'sortant' && values.type !== 'note' ? addDaysISO(days) : (contact.next_followup ?? ''));
  }, [contact?.id, contact?.status, values.direction, values.type, days, interaction]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!values.date) return;
    try {
      await save.mutateAsync({ id: interaction?.id, ...values });
      if (contact && !interaction && updateContact && !planned) {
        await api.patch(`/contacts/${contact.id}`, { status: nextStatus, next_followup: followup || null });
      }
      toast.success(interaction ? 'Échange mis à jour' : planned ? 'Action planifiée' : 'Échange ajouté au journal');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const del = async () => {
    if (!interaction) return;
    if (!(await confirm({ title: 'Supprimer cet échange du journal ?', confirmLabel: 'Supprimer', danger: true }))) return;
    await remove.mutateAsync(interaction.id);
    toast.success('Échange supprimé');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={interaction ? "Modifier l'échange" : defaults?.direction === 'prevu' ? 'Planifier une action' : 'Noter un échange'}
      size="lg"
      onSubmit={submit}
      footer={
        <>
          {interaction && (
            <Button variant="danger-ghost" className="mr-auto" icon={<Trash2 />} onClick={del}>
              Supprimer
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type d'échange">
          {INTERACTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={values.type === t.value}
              onClick={() => set('type', t.value)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors',
                values.type === t.value
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
              )}
            >
              <InteractionIcon type={t.value} className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <FormGrid>
          <Field label="Sens">
            {() => (
              <Segmented
                value={values.direction as 'sortant' | 'entrant' | 'prevu'}
                onChange={(v) => set('direction', v)}
                options={[
                  { value: 'sortant', label: 'De moi' },
                  { value: 'entrant', label: "De l'interlocuteur" },
                  { value: 'prevu', label: 'À faire' },
                ]}
              />
            )}
          </Field>
          <Field label={planned ? (isCall ? 'Date du call' : "Date d'envoi prévue") : 'Date'}>{(id) => <Input id={id} type="datetime-local" {...bind('date')} />}</Field>
          <Field label="Contact">{(id) => <ContactPicker id={id} value={values.contact_id} onChange={(v) => set('contact_id', v)} />}</Field>
          <Field label="Offre liée">{(id) => <JobPicker id={id} value={values.job_id} onChange={(v) => set('job_id', v)} />}</Field>
        </FormGrid>
        <Field label={isCall ? 'Thème du call' : 'Objet'}>
          {(id) => <Input id={id} {...bind('subject')} placeholder={isCall ? 'ex. Présentation du poste, point réseau…' : 'ex. Premier message, relance…'} />}
        </Field>
        {isCall && (
          <Field label="Lien de la visio" hint="Laisser vide si c'est un appel téléphonique.">
            {(id) => <Input id={id} {...bind('link')} placeholder="https://meet.google.com/… ou https://teams.microsoft.com/…" />}
          </Field>
        )}
        <Field label={planned && !isCall ? 'Message à envoyer' : 'Contenu / notes'}>{(id) => <Textarea id={id} rows={5} {...bind('content')} />}</Field>

        {contact && !interaction && !planned && (
          <div className="rounded-xl border border-line bg-surface-2/60 p-4">
            <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <input type="checkbox" checked={updateContact} onChange={(e) => setUpdateContact(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Mettre à jour le suivi de {contact.first_name || 'ce contact'}
            </label>
            {updateContact && (
              <FormGrid className="mt-3">
                <Field label="Avancement">{(id) => <Select id={id} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} options={CONTACT_STATUSES} />}</Field>
                <Field label="Prochaine relance" hint={`Par défaut : dans ${days} jours après un envoi.`}>
                  {(id) => <Input id={id} type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} />}
                </Field>
              </FormGrid>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
