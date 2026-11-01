import { Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { INTERVIEW_FORMATS, INTERVIEW_KINDS, INTERVIEW_OUTCOMES, INTERVIEW_STATUSES } from '../../../shared/constants';
import type { Interview } from '../../../shared/types';
import { CompanyPicker, ContactPicker, JobPicker } from '../../components/pickers';
import { Button } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog, useConfirm } from '../../components/ui/overlay';
import { errorMessage, useList, useRemove, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';

const EMPTY = {
  job_id: null as number | null,
  company_id: null as number | null,
  contact_id: null as number | null,
  scheduled_at: '',
  duration: '' as string,
  kind: 'rh',
  format: 'visio',
  place: '',
  interviewers: '',
  status: 'prevu',
  outcome: 'en_attente',
  preparation: '',
  notes: '',
  next_steps: '',
};

export function InterviewForm({
  open,
  onOpenChange,
  interview,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  interview?: Interview | null;
  defaults?: { job_id?: number | null; company_id?: number | null; contact_id?: number | null };
}) {
  const save = useSave('interviews');
  const remove = useRemove('interviews');
  const confirm = useConfirm();
  const { data: jobs = [] } = useList('jobs');
  const { values, set, bind, reset } = useFormState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (interview) {
      reset({
        job_id: interview.job_id,
        company_id: interview.company_id,
        contact_id: interview.contact_id,
        scheduled_at: interview.scheduled_at,
        duration: interview.duration ? String(interview.duration) : '',
        kind: interview.kind,
        format: interview.format,
        place: interview.place,
        interviewers: interview.interviewers,
        status: interview.status,
        outcome: interview.outcome,
        preparation: interview.preparation,
        notes: interview.notes,
        next_steps: interview.next_steps,
      });
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      reset({
        ...EMPTY,
        scheduled_at: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`,
        duration: '45',
        job_id: defaults?.job_id ?? null,
        company_id: defaults?.company_id ?? null,
        contact_id: defaults?.contact_id ?? null,
      });
    }
  }, [open, interview, defaults?.job_id, defaults?.company_id, defaults?.contact_id, reset]);

  const onJob = (id: number | null) => {
    set('job_id', id);
    const job = jobs.find((j) => j.id === id);
    if (job?.company_id && !values.company_id) set('company_id', job.company_id);
  };

  const submit = async () => {
    if (!values.scheduled_at) return;
    try {
      await save.mutateAsync({
        id: interview?.id,
        ...values,
        duration: values.duration ? Number(values.duration) : null,
      });
      toast.success(interview ? 'Entretien mis à jour' : 'Entretien planifié');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const del = async () => {
    if (!interview) return;
    if (!(await confirm({ title: 'Supprimer cet entretien ?', confirmLabel: 'Supprimer', danger: true }))) return;
    await remove.mutateAsync(interview.id);
    toast.success('Entretien supprimé');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={interview ? 'Entretien' : 'Nouvel entretien'}
      size="xl"
      onSubmit={submit}
      footer={
        <>
          {interview && (
            <Button variant="danger-ghost" className="mr-auto" icon={<Trash2 />} onClick={del}>
              Supprimer
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !values.scheduled_at}>
            {interview ? 'Enregistrer' : "Planifier l'entretien"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <FormGrid className="content-start">
          <Field label="Offre">{(id) => <JobPicker id={id} value={values.job_id} onChange={onJob} />}</Field>
          <Field label="Entreprise">{(id) => <CompanyPicker id={id} value={values.company_id} onChange={(v) => set('company_id', v)} />}</Field>
          <Field label="Date et heure *">{(id) => <Input id={id} type="datetime-local" {...bind('scheduled_at')} />}</Field>
          <Field label="Durée (min)">{(id) => <Input id={id} type="number" min={5} step={5} {...bind('duration')} />}</Field>
          <Field label="Type">{(id) => <Select id={id} {...bind('kind')} options={INTERVIEW_KINDS} />}</Field>
          <Field label="Format">{(id) => <Select id={id} {...bind('format')} options={INTERVIEW_FORMATS} />}</Field>
          <Field label="Lieu ou lien visio" className="sm:col-span-2">
            {(id) => <Input id={id} {...bind('place')} placeholder="Adresse, ou lien Teams / Meet / Zoom" />}
          </Field>
          <Field label="Interlocuteurs">{(id) => <Input id={id} {...bind('interviewers')} placeholder="Noms et fonctions" />}</Field>
          <Field label="Contact lié">
            {(id) => <ContactPicker id={id} value={values.contact_id} onChange={(v) => set('contact_id', v)} companyId={values.company_id} />}
          </Field>
          <Field label="Statut">{(id) => <Select id={id} {...bind('status')} options={INTERVIEW_STATUSES} />}</Field>
          <Field label="Retour">{(id) => <Select id={id} {...bind('outcome')} options={INTERVIEW_OUTCOMES} />}</Field>
        </FormGrid>
        <div className="space-y-4">
          <Field label="Préparation" hint="Questions à poser, points à mettre en avant, recherches.">
            {(id) => <Textarea id={id} rows={5} {...bind('preparation')} />}
          </Field>
          <Field label="Compte rendu">{(id) => <Textarea id={id} rows={5} {...bind('notes')} placeholder="Ce qui s'est dit, impressions…" />}</Field>
          <Field label="Prochaines étapes">{(id) => <Textarea id={id} rows={2} {...bind('next_steps')} />}</Field>
        </div>
      </div>
    </Dialog>
  );
}
