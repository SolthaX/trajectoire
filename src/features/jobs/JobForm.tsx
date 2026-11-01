import { useEffect } from 'react';
import { toast } from 'sonner';
import { CONTRACTS, JOB_STATUSES, PRIORITIES, REMOTE_MODES } from '../../../shared/constants';
import type { Job } from '../../../shared/types';
import { CompanyPicker, ContactPicker } from '../../components/pickers';
import { Button } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { errorMessage, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';

const EMPTY = {
  title: '',
  company_id: null as number | null,
  contact_id: null as number | null,
  url: '',
  location: '',
  contract: '',
  remote: '',
  salary: '',
  status: 'a_etudier',
  priority: 'moyenne',
  deadline: '',
  applied_at: '',
  description: '',
  notes: '',
};

export function JobForm({
  open,
  onOpenChange,
  job,
  companyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  job?: Job | null;
  companyId?: number | null;
  onSaved?: (j: Job) => void;
}) {
  const save = useSave('jobs');
  const { values, set, bind, reset } = useFormState(EMPTY);

  useEffect(() => {
    if (!open) return;
    reset(
      job
        ? {
            title: job.title,
            company_id: job.company_id,
            contact_id: job.contact_id,
            url: job.url,
            location: job.location,
            contract: job.contract,
            remote: job.remote,
            salary: job.salary,
            status: job.status,
            priority: job.priority,
            deadline: job.deadline ?? '',
            applied_at: job.applied_at ?? '',
            description: job.description,
            notes: job.notes,
          }
        : { ...EMPTY, company_id: companyId ?? null },
    );
  }, [open, job, companyId, reset]);

  const submit = async () => {
    if (!values.title.trim()) return;
    try {
      const saved = await save.mutateAsync({
        id: job?.id,
        ...values,
        deadline: values.deadline || null,
        applied_at: values.applied_at || null,
      });
      toast.success(job ? 'Offre mise à jour' : 'Offre ajoutée');
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
      title={job ? "Modifier l'offre" : 'Nouvelle offre'}
      description={job ? undefined : "Collez le lien et le texte de l'annonce pour les garder sous la main."}
      size="xl"
      onSubmit={submit}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !values.title.trim()}>
            {job ? 'Enregistrer' : "Ajouter l'offre"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Field label="Intitulé du poste *">{(id) => <Input id={id} {...bind('title')} placeholder="ex. Chef de projet data" />}</Field>
          <Field label="Lien de l'annonce">{(id) => <Input id={id} {...bind('url')} placeholder="https://…" />}</Field>
          <FormGrid>
            <Field label="Entreprise">
              {(id) => <CompanyPicker id={id} value={values.company_id} onChange={(v) => set('company_id', v)} />}
            </Field>
            <Field label="Contact référent">
              {(id) => <ContactPicker id={id} value={values.contact_id} onChange={(v) => set('contact_id', v)} companyId={values.company_id} />}
            </Field>
            <Field label="Lieu">{(id) => <Input id={id} {...bind('location')} placeholder="ex. Lyon" />}</Field>
            <Field label="Rémunération">{(id) => <Input id={id} {...bind('salary')} placeholder="ex. 50–55 k€" />}</Field>
            <Field label="Contrat">{(id) => <Select id={id} {...bind('contract')} options={CONTRACTS} placeholder="—" />}</Field>
            <Field label="Télétravail">{(id) => <Select id={id} {...bind('remote')} options={REMOTE_MODES} placeholder="—" />}</Field>
            <Field label="Statut">{(id) => <Select id={id} {...bind('status')} options={JOB_STATUSES} />}</Field>
            <Field label="Priorité">{(id) => <Select id={id} {...bind('priority')} options={PRIORITIES} />}</Field>
            <Field label="Date limite">{(id) => <Input id={id} type="date" {...bind('deadline')} />}</Field>
            <Field label="Postulé le" hint="Rempli automatiquement au passage à « Postulé ».">
              {(id) => <Input id={id} type="date" {...bind('applied_at')} />}
            </Field>
          </FormGrid>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Texte de l'annonce" className="flex-1">
            {(id) => (
              <Textarea
                id={id}
                {...bind('description')}
                rows={14}
                className="min-h-[260px] flex-1 [field-sizing:fixed]"
                placeholder="Missions, profil recherché, conditions…"
              />
            )}
          </Field>
          <Field label="Notes">{(id) => <Textarea id={id} {...bind('notes')} rows={3} placeholder="Points forts, doutes, questions à poser…" />}</Field>
        </div>
      </div>
    </Dialog>
  );
}
