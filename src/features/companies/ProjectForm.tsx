import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PROJECT_STATUSES } from '../../../shared/constants';
import { projectScore } from '../../../shared/score';
import type { Project, ProjectLink } from '../../../shared/types';
import { ScoreBadge, ScoreInput } from '../../components/badges';
import { Button, IconButton } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog, useConfirm } from '../../components/ui/overlay';
import { errorMessage, useList, useRemove, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';

const EMPTY = {
  name: '',
  status: 'en_cours',
  start_date: '',
  end_date: '',
  summary: '',
  details: '',
  notes: '',
  links: [] as ProjectLink[],
  scores: {} as Record<string, number | null>,
};

export function ProjectForm({
  open,
  onOpenChange,
  companyId,
  project,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: number;
  project?: Project | null;
}) {
  const save = useSave('projects');
  const remove = useRemove('projects');
  const confirm = useConfirm();
  const { data: criteria = [] } = useList('criteria');
  const { values, set, bind, reset } = useFormState(EMPTY);

  useEffect(() => {
    if (!open) return;
    reset(
      project
        ? {
            name: project.name,
            status: project.status,
            start_date: project.start_date ?? '',
            end_date: project.end_date ?? '',
            summary: project.summary,
            details: project.details,
            notes: project.notes,
            links: project.links ?? [],
            scores: project.scores ?? {},
          }
        : EMPTY,
    );
  }, [open, project, reset]);

  const score = projectScore(values.scores, criteria);

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: project?.id,
        company_id: companyId,
        ...values,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        links: values.links.filter((l) => l.url.trim()),
      });
      toast.success(project ? 'Projet mis à jour' : 'Projet ajouté');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const del = async () => {
    if (!project) return;
    if (!(await confirm({ title: 'Supprimer ce projet ?', message: `« ${project.name} » et ses notes seront supprimés.`, confirmLabel: 'Supprimer', danger: true })))
      return;
    await remove.mutateAsync(project.id);
    toast.success('Projet supprimé');
    onOpenChange(false);
  };

  const setLink = (i: number, patch: Partial<ProjectLink>) =>
    set(
      'links',
      values.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? 'Fiche projet' : 'Nouveau projet'}
      description="Ce que l'entreprise fait ou va faire, et ce que vous en pensez."
      size="xl"
      onSubmit={submit}
      footer={
        <>
          {project && (
            <Button variant="danger-ghost" className="mr-auto" icon={<Trash2 />} onClick={del}>
              Supprimer
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !values.name.trim()}>
            {project ? 'Enregistrer' : 'Ajouter le projet'}
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <FormGrid>
            <Field label="Nom du projet *" className="sm:col-span-2">
              {(id) => <Input id={id} {...bind('name')} placeholder="ex. Nouvelle plateforme de données client" />}
            </Field>
            <Field label="Statut">{(id) => <Select id={id} {...bind('status')} options={PROJECT_STATUSES} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début">{(id) => <Input id={id} type="date" {...bind('start_date')} />}</Field>
              <Field label="Fin">{(id) => <Input id={id} type="date" {...bind('end_date')} />}</Field>
            </div>
          </FormGrid>
          <Field label="En bref" hint="Une ou deux phrases, affichées sur la carte du projet.">
            {(id) => <Textarea id={id} rows={2} {...bind('summary')} placeholder="Ce qu'ils construisent, pour qui, pourquoi." />}
          </Field>
          <Field label="Détails">
            {(id) => (
              <Textarea
                id={id}
                rows={6}
                {...bind('details')}
                placeholder={'Contexte, enjeux, équipes, technos, calendrier, sources…\nCe que vous pourriez y apporter.'}
              />
            )}
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">Liens (articles, annonces, rapports…)</span>
              <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => set('links', [...values.links, { label: '', url: '' }])}>
                Ajouter un lien
              </Button>
            </div>
            <div className="space-y-2">
              {values.links.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.6fr_auto] gap-2">
                  <Input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="Libellé" aria-label="Libellé du lien" />
                  <Input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://…" aria-label="Adresse du lien" />
                  <IconButton
                    label="Retirer"
                    size="md"
                    onClick={() =>
                      set(
                        'links',
                        values.links.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
          <Field label="Notes">{(id) => <Textarea id={id} {...bind('notes')} placeholder="Notes personnelles" />}</Field>
        </div>

        <aside className="rounded-xl border border-line bg-surface-2/60 p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink">Mes critères</h3>
            <ScoreBadge score={score} />
          </div>
          <p className="mb-4 text-[12px] text-ink-3">
            Notez de 1 à 5. Score pondéré sur les critères notés.{' '}
            <Link to="/parametres" className="text-accent-ink hover:underline" onClick={() => onOpenChange(false)}>
              Gérer les critères
            </Link>
          </p>
          {criteria.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">Aucun critère défini.</p>
          ) : (
            <div className="space-y-3.5">
              {criteria.map((c) => (
                <div key={c.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-ink" title={c.description}>
                      {c.name}
                    </span>
                    <span className="tabular text-[11px] text-ink-3">×{c.weight.toLocaleString('fr-FR')}</span>
                  </div>
                  <ScoreInput
                    label={c.name}
                    value={values.scores[String(c.id)] ?? null}
                    onChange={(v) => set('scores', { ...values.scores, [String(c.id)]: v })}
                  />
                  {c.description && <p className="mt-1 text-[11.5px] text-ink-3">{c.description}</p>}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </Dialog>
  );
}
