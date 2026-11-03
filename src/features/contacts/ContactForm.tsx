import { Plus, X } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { CIVILITIES, CONTACT_STATUSES, PRIORITIES } from '../../../shared/constants';
import type { Affiliation, Contact } from '../../../shared/types';
import { CompanyPicker } from '../../components/pickers';
import { Button, IconButton } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { errorMessage, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';
import { joinList, splitList } from '../../lib/format';

/** Liste éditable de valeurs (stockées une par ligne). */
function MultiInput({ label, value, onChange, type, placeholder, addLabel }: { label: string; value: string; onChange: (v: string) => void; type: string; placeholder: string; addLabel: string }) {
  const items = value.split('\n');
  const update = (next: string[]) => onChange(next.join('\n'));
  return (
    <Field label={label}>
      {(id) => (
        <div className="space-y-1.5">
          {items.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input id={i === 0 ? id : undefined} type={type} value={v} placeholder={placeholder} onChange={(e) => update(items.map((x, j) => (j === i ? e.target.value : x)))} />
              {items.length > 1 && (
                <IconButton label="Retirer" size="xs" onClick={() => update(items.filter((_, j) => j !== i))}>
                  <X />
                </IconButton>
              )}
            </div>
          ))}
          <button type="button" onClick={() => update([...items, ''])} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
            <Plus className="size-3" /> {addLabel}
          </button>
        </div>
      )}
    </Field>
  );
}

const EMPTY = {
  civility: '',
  first_name: '',
  last_name: '',
  company_id: null as number | null,
  role: '',
  email: '',
  phone: '',
  linkedin: '',
  status: 'non_contacte',
  priority: 'moyenne',
  next_followup: '',
  source: '',
  notes: '',
  affiliations: [] as Affiliation[],
};

/** Entreprises secondaires (associations, réseaux, anciens employeurs…), chacune avec un rôle. */
function AffiliationsInput({ value, onChange }: { value: Affiliation[]; onChange: (v: Affiliation[]) => void }) {
  const update = (i: number, patch: Partial<Affiliation>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 text-[12px] font-medium text-ink-2">Autres entreprises</div>
      {value.length > 0 && (
        <div className="mb-1.5 space-y-1.5">
          {value.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5">
              <CompanyPicker value={a.company_id || null} onChange={(v) => update(i, { company_id: v ?? 0 })} />
              <Input value={a.role} onChange={(e) => update(i, { role: e.target.value })} placeholder="Rôle (ex. bénévole, administratrice)" aria-label="Rôle" />
              <IconButton label="Retirer" size="xs" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onChange([...value, { company_id: 0, role: '' }])} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
        <Plus className="size-3" /> Ajouter une entreprise (association, réseau, ancien employeur…)
      </button>
    </div>
  );
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  companyId,
  source,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact?: Contact | null;
  companyId?: number | null;
  /** Origine proposée à la création (ex. « Rencontré à … »). */
  source?: string;
  onSaved?: (c: Contact) => void;
}) {
  const save = useSave('contacts');
  const { values, set, bind, reset } = useFormState(EMPTY);

  useEffect(() => {
    if (!open) return;
    reset(
      contact
        ? {
            civility: contact.civility,
            first_name: contact.first_name,
            last_name: contact.last_name,
            company_id: contact.company_id,
            role: contact.role,
            email: splitList(contact.email).join('\n'),
            phone: splitList(contact.phone).join('\n'),
            linkedin: contact.linkedin,
            status: contact.status,
            priority: contact.priority,
            next_followup: contact.next_followup ?? '',
            source: contact.source,
            notes: contact.notes,
            affiliations: (contact.affiliations ?? []).map((a) => ({ company_id: a.company_id, role: a.role })),
          }
        : { ...EMPTY, company_id: companyId ?? null, source: source ?? '' },
    );
  }, [open, contact, companyId, source, reset]);

  const valid = !!(values.first_name.trim() || values.last_name.trim() || values.email.trim());
  const payload = () => ({
    ...values,
    email: joinList(values.email.split('\n')),
    phone: joinList(values.phone.split('\n')),
    affiliations: values.affiliations.filter((a) => a.company_id),
  });

  const submit = async () => {
    if (!valid) return;
    try {
      const saved = await save.mutateAsync({ id: contact?.id, ...payload(), next_followup: values.next_followup || null });
      toast.success(contact ? 'Contact mis à jour' : 'Contact ajouté');
      onOpenChange(false);
      onSaved?.(saved);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={contact ? 'Modifier le contact' : 'Nouveau contact'}
      size="lg"
      onSubmit={submit}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !valid}>
            {contact ? 'Enregistrer' : 'Ajouter le contact'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-[90px_1fr_1fr] gap-3">
          <Field label="Civilité">{(id) => <Select id={id} {...bind('civility')} options={CIVILITIES} />}</Field>
          <Field label="Prénom">{(id) => <Input id={id} {...bind('first_name')} autoComplete="off" />}</Field>
          <Field label="Nom">{(id) => <Input id={id} {...bind('last_name')} autoComplete="off" />}</Field>
        </div>
        <FormGrid>
          <Field label="Entreprise principale">{(id) => <CompanyPicker id={id} value={values.company_id} onChange={(v) => set('company_id', v)} />}</Field>
          <Field label="Poste">{(id) => <Input id={id} {...bind('role')} placeholder="ex. Directrice technique" />}</Field>
          <AffiliationsInput value={values.affiliations} onChange={(v) => set('affiliations', v)} />
          <MultiInput label="Emails" type="email" value={values.email} onChange={(v) => set('email', v)} placeholder="prenom.nom@entreprise.fr" addLabel="Ajouter un email" />
          <MultiInput label="Téléphones" type="tel" value={values.phone} onChange={(v) => set('phone', v)} placeholder="06 12 34 56 78" addLabel="Ajouter un numéro" />
          <Field label="LinkedIn" className="sm:col-span-2">
            {(id) => <Input id={id} {...bind('linkedin')} placeholder="https://www.linkedin.com/in/…" />}
          </Field>
          <Field label="Avancement">{(id) => <Select id={id} {...bind('status')} options={CONTACT_STATUSES} />}</Field>
          <Field label="Priorité">{(id) => <Select id={id} {...bind('priority')} options={PRIORITIES} />}</Field>
          <Field label="Prochaine relance">{(id) => <Input id={id} type="date" {...bind('next_followup')} />}</Field>
          <Field label="Origine du contact">{(id) => <Input id={id} {...bind('source')} placeholder="ex. Salon, ancien collègue, LinkedIn…" />}</Field>
        </FormGrid>
        <Field label="Notes">{(id) => <Textarea id={id} {...bind('notes')} />}</Field>
      </div>
    </Dialog>
  );
}
