import { clsx } from 'clsx';
import { Copy, Mail, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES } from '../../../shared/constants';
import type { Template } from '../../../shared/types';
import { ContactPicker } from '../../components/pickers';
import { Button } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { useConfirm } from '../../components/ui/overlay';
import { Card, EmptyState, Loading, PageHeader } from '../../components/ui/misc';
import { errorMessage, useItem, useList, useRemove, useSave, useSettings } from '../../lib/api';
import { useFormState } from '../../lib/form';
import { buildVariables, fillTemplate } from '../../lib/template';

const GROUPS = ['Contact', 'Entreprise', 'Offre', 'Moi', 'Divers'] as const;

function Editor({ template, onDeleted, onDuplicated }: { template: Template; onDeleted: () => void; onDuplicated: (t: Template) => void }) {
  const save = useSave('templates');
  const remove = useRemove('templates');
  const confirm = useConfirm();
  const { data: settings } = useSettings();
  const { values, set, bind, reset } = useFormState({ name: '', category: 'autre', subject: '', body: '' });
  const [previewContactId, setPreviewContactId] = useState<number | null>(null);
  const { data: previewContact } = useItem('contacts', previewContactId);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    reset({ name: template.name, category: template.category, subject: template.subject, body: template.body });
  }, [template.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    values.name !== template.name || values.category !== template.category || values.subject !== template.subject || values.body !== template.body;

  const insert = (key: string) => {
    const token = `{{${key}}}`;
    const field = lastFocus.current;
    const el = field === 'body' ? bodyRef.current : subjectRef.current;
    const current = values[field];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    set(field, current.slice(0, start) + token + current.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const vars = useMemo(() => {
    const v = buildVariables({ contact: previewContact, profile: settings?.profile });
    // Exemples lisibles quand aucun contact n'est choisi pour l'aperçu.
    const sample: Record<string, string> = {
      civilite: 'Madame',
      prenom: 'Camille',
      nom: 'Martin',
      poste_contact: 'Responsable recrutement',
      entreprise: 'Entreprise Exemple',
      projet: 'Projet Exemple',
      poste: 'Chef de projet',
      lien_offre: 'https://…',
    };
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val || (previewContact ? '' : (sample[k] ?? ''))]));
  }, [previewContact, settings?.profile]);

  const preview = { subject: fillTemplate(values.subject, vars), body: fillTemplate(values.body, vars) };
  const missing = [...new Set([...preview.subject.missing, ...preview.body.missing])];

  const submit = async () => {
    try {
      await save.mutateAsync({ id: template.id, ...values });
      toast.success('Modèle enregistré');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const del = async () => {
    if (!(await confirm({ title: `Supprimer « ${template.name} » ?`, confirmLabel: 'Supprimer', danger: true }))) return;
    await remove.mutateAsync(template.id);
    toast.success('Modèle supprimé');
    onDeleted();
  };

  const duplicate = async () => {
    const t = await save.mutateAsync({ ...values, name: `${values.name} (copie)` });
    toast.success('Modèle dupliqué');
    onDuplicated(t);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              submit();
            }
          }}
          className="space-y-4"
        >
          <FormGrid>
            <Field label="Nom du modèle">{(id) => <Input id={id} {...bind('name')} />}</Field>
            <Field label="Catégorie">{(id) => <Select id={id} {...bind('category')} options={TEMPLATE_CATEGORIES} />}</Field>
          </FormGrid>
          <Field label="Objet">
            {(id) => <Input id={id} ref={subjectRef} {...bind('subject')} onFocus={() => (lastFocus.current = 'subject')} />}
          </Field>
          <Field label="Message">
            {(id) => (
              <Textarea id={id} ref={bodyRef} {...bind('body')} rows={14} className="min-h-[300px]" onFocus={() => (lastFocus.current = 'body')} />
            )}
          </Field>
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-ink-2">Insérer une variable (à l'endroit du curseur)</div>
            <div className="space-y-1.5">
              {GROUPS.map((g) => (
                <div key={g} className="flex flex-wrap items-center gap-1">
                  <span className="w-[72px] text-[11.5px] text-ink-3">{g}</span>
                  {TEMPLATE_VARIABLES.filter((v) => v.group === g).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      title={v.label}
                      onClick={() => insert(v.key)}
                      className="h-6 rounded-md border border-line bg-surface-2/60 px-1.5 font-mono text-[11.5px] text-ink-2 hover:border-line-strong hover:text-ink"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-line pt-4">
            <Button variant="danger-ghost" icon={<Trash2 />} onClick={del}>
              Supprimer
            </Button>
            <Button variant="ghost" icon={<Copy />} onClick={duplicate}>
              Dupliquer
            </Button>
            <span className="ml-auto text-[12px] text-ink-3">{dirty ? 'Modifications non enregistrées' : 'Enregistré'}</span>
            <Button type="submit" variant="primary" disabled={!dirty || save.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium whitespace-nowrap text-ink-2">Aperçu avec</span>
          <div className="flex-1">
            <ContactPicker value={previewContactId} onChange={setPreviewContactId} />
          </div>
        </div>
        <Card className="bg-surface">
          <div className="mb-3 border-b border-line pb-3">
            <div className="text-[11.5px] text-ink-3">Objet</div>
            <div className="text-[14px] font-medium text-ink">{preview.subject.text || <span className="text-ink-3">(vide)</span>}</div>
          </div>
          <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2">{preview.body.text}</div>
        </Card>
        {missing.length > 0 && (
          <p className="text-[12px] text-warning-ink">Non remplies dans cet aperçu : {missing.map((m) => `{{${m}}}`).join(', ')}</p>
        )}
        {!previewContact && <p className="text-[12px] text-ink-3">Valeurs d'exemple. Choisissez un contact pour un aperçu réel.</p>}
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const { data = [], isLoading } = useList('templates');
  const save = useSave('templates');
  const [selected, setSelected] = useState<number | null>(null);
  const current = data.find((t) => t.id === selected) ?? data[0];

  const create = async () => {
    const t = await save.mutateAsync({ name: 'Nouveau modèle', category: 'autre', subject: '', body: 'Bonjour {{prenom}},\n\n\n\n{{signature}}' });
    setSelected(t.id);
  };

  return (
    <>
      <PageHeader
        title="Modèles de mails"
        description="Rédigez une fois, réutilisez partout : les variables sont remplies depuis la fiche contact."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={create}>
            Nouveau modèle
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState icon={<Mail />} title="Aucun modèle" action={<Button onClick={create}>Créer un modèle</Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="space-y-4">
            {TEMPLATE_CATEGORIES.map((cat) => {
              const items = data.filter((t) => t.category === cat.value);
              if (!items.length) return null;
              return (
                <div key={cat.value}>
                  <div className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{cat.label}</div>
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className={clsx(
                        'block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                        current?.id === t.id ? 'bg-surface font-medium text-ink shadow-xs ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          {current && <Editor key={current.id} template={current} onDeleted={() => setSelected(null)} onDuplicated={(t) => setSelected(t.id)} />}
        </div>
      )}
    </>
  );
}
