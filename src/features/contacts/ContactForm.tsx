import { useEffect } from 'react';
import { toast } from 'sonner';
import { CIVILITIES, CONTACT_STATUSES, PRIORITIES } from '../../../shared/constants';
import type { Contact } from '../../../shared/types';
import { CompanyPicker } from '../../components/pickers';
import { Button } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { errorMessage, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';

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
};

export function ContactForm({
  open,
  onOpenChange,
  contact,
  companyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact?: Contact | null;
  companyId?: number | null;
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
            email: contact.email,
            phone: contact.phone,
            linkedin: contact.linkedin,
            status: contact.status,
            priority: contact.priority,
            next_followup: contact.next_followup ?? '',
            source: contact.source,
            notes: contact.notes,
          }
        : { ...EMPTY, company_id: companyId ?? null },
    );
  }, [open, contact, companyId, reset]);

  const valid = !!(values.first_name.trim() || values.last_name.trim() || values.email.trim());

  const submit = async () => {
    if (!valid) return;
    try {
      const saved = await save.mutateAsync({ id: contact?.id, ...values, next_followup: values.next_followup || null });
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
          <Field label="Entreprise">{(id) => <CompanyPicker id={id} value={values.company_id} onChange={(v) => set('company_id', v)} />}</Field>
          <Field label="Poste">{(id) => <Input id={id} {...bind('role')} placeholder="ex. Directrice technique" />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" {...bind('email')} placeholder="prenom.nom@entreprise.fr" />}</Field>
          <Field label="Téléphone">{(id) => <Input id={id} type="tel" {...bind('phone')} placeholder="06 12 34 56 78" />}</Field>
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
