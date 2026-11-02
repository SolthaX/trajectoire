import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AlertTriangle, Copy, ExternalLink, Mail } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { CONTACT_STATUSES, TEMPLATE_CATEGORIES, labelOf } from '../../../shared/constants';
import type { Contact } from '../../../shared/types';
import { Button, buttonClass } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { api, errorMessage, refreshAll, useList, useSettings } from '../../lib/api';
import { addDaysISO, nowLocalISO, splitList } from '../../lib/format';
import { buildVariables, fillTemplate } from '../../lib/template';
import { suggestStatus } from '../interactions/InteractionForm';

function mailUrls(to: string, subject: string, body: string) {
  const e = encodeURIComponent;
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to)}&su=${e(subject)}&body=${e(body)}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${e(to)}&subject=${e(subject)}&body=${e(body)}`,
    mailto: `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${e(subject)}&body=${e(body.replace(/\r?\n/g, '\r\n'))}`,
  };
}

export function MailComposer({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (o: boolean) => void; contact: Contact }) {
  const qc = useQueryClient();
  const { data: templates = [] } = useList('templates');
  const { data: jobs = [] } = useList('jobs', contact.company_id ? { company_id: contact.company_id } : undefined, { enabled: !!contact.company_id });
  const { data: projects = [] } = useList('projects', contact.company_id ? { company_id: contact.company_id } : undefined, { enabled: !!contact.company_id });
  const { data: settings } = useSettings();

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [jobId, setJobId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [opened, setOpened] = useState(false);
  const [nextStatus, setNextStatus] = useState(contact.status);
  const [followup, setFollowup] = useState('');
  const [saving, setSaving] = useState(false);

  const days = settings?.followup_days ?? 7;
  const template = templates.find((t) => t.id === templateId);
  const job = jobs.find((j) => String(j.id) === jobId) ?? null;
  const project = projects.find((p) => String(p.id) === projectId) ?? null;

  // Valeurs initiales à l'ouverture.
  useEffect(() => {
    if (!open) return;
    setTo(splitList(contact.email).join(', '));
    setOpened(false);
    setNextStatus(suggestStatus(contact.status, 'sortant', 'email'));
    setFollowup(addDaysISO(days));
    const preferred =
      templates.find((t) => t.category === (contact.status === 'non_contacte' ? 'premier_contact' : 'relance')) ?? templates[0];
    setTemplateId(preferred?.id ?? null);
    setJobId(jobs.length === 1 ? String(jobs[0].id) : '');
    setProjectId(projects.length >= 1 ? String(projects[0].id) : '');
  }, [open, contact.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les listes peuvent arriver après l'ouverture : on choisit alors un modèle par défaut.
  useEffect(() => {
    if (!open || templateId != null || !templates.length) return;
    const preferred = templates.find((t) => t.category === (contact.status === 'non_contacte' ? 'premier_contact' : 'relance')) ?? templates[0];
    setTemplateId(preferred.id);
  }, [open, templates, templateId, contact.status]);

  const vars = useMemo(
    () => buildVariables({ contact, job, project, profile: settings?.profile, companyName: contact.company_name }),
    [contact, job, project, settings?.profile],
  );

  // Recalcule le texte quand on change de modèle / offre / projet.
  useEffect(() => {
    if (!open || !template) return;
    setSubject(fillTemplate(template.subject, vars).text);
    setBody(fillTemplate(template.body, vars).text);
  }, [open, template, vars]);

  const missing = useMemo(() => {
    const re = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;
    return [...new Set([...`${subject}\n${body}`.matchAll(re)].map((m) => m[1]))];
  }, [subject, body]);

  const urls = mailUrls(to, subject, body);

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    toast.success('Texte copié');
    setOpened(true);
  };

  const logSent = async () => {
    setSaving(true);
    try {
      await api.post('/interactions', {
        contact_id: contact.id,
        job_id: job?.id ?? null,
        type: 'email',
        direction: 'sortant',
        date: nowLocalISO(),
        subject,
        content: body,
      });
      await api.patch(`/contacts/${contact.id}`, { status: nextStatus, next_followup: followup || null });
      await refreshAll(qc);
      toast.success('Envoi enregistré dans le journal');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const grouped = TEMPLATE_CATEGORIES.map((cat) => ({ cat, items: templates.filter((t) => t.category === cat.value) })).filter((g) => g.items.length);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Écrire à ${contact.first_name || contact.last_name || contact.email}`}
      description="Choisissez un modèle : les variables sont remplies automatiquement, vous pouvez retoucher le texte."
      size="xl"
      footer={
        <>
          <div className="mr-auto flex flex-wrap items-center gap-3 text-[12.5px] text-ink-2">
            <span className="font-medium text-ink">Après l'envoi :</span>
            <label className="flex items-center gap-1.5">
              Avancement
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink outline-none"
              >
                {CONTACT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Relance le
              <input
                type="date"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink outline-none"
              />
            </label>
          </div>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button variant={opened ? 'primary' : 'secondary'} onClick={logSent} disabled={saving}>
            Marquer comme envoyé
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-ink-2">Modèle</div>
            {templates.length === 0 ? (
              <p className="text-[12.5px] text-ink-3">
                Aucun modèle.{' '}
                <Link to="/modeles" className="text-accent-ink hover:underline">
                  Créer un modèle
                </Link>
              </p>
            ) : (
              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {grouped.map((g) => (
                  <div key={g.cat.value}>
                    <div className="mb-1 text-[10.5px] font-medium tracking-wide text-ink-3 uppercase">{g.cat.label}</div>
                    <div className="space-y-0.5">
                      {g.items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTemplateId(t.id)}
                          className={clsx(
                            'block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                            t.id === templateId ? 'bg-ink font-medium text-bg' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                          )}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {contact.company_id && (
            <>
              <Field label="Offre ({{poste}})">
                {(id) => (
                  <Select
                    id={id}
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    options={jobs.map((j) => ({ value: String(j.id), label: j.title }))}
                    placeholder="Aucune"
                  />
                )}
              </Field>
              <Field label="Projet ({{projet}})">
                {(id) => (
                  <Select
                    id={id}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                    placeholder="Aucun"
                  />
                )}
              </Field>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <FormGrid cols={1}>
            <Field label="À">{(id) => <Input id={id} value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@entreprise.fr" />}</Field>
            <Field label="Objet">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
            <Field label="Message">
              {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} rows={13} className="min-h-[280px]" />}
            </Field>
          </FormGrid>
          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Variables non remplies : {missing.map((m) => `{{${m}}}`).join(', ')}.{' '}
                {missing.some((m) => m.startsWith('mon_') || m === 'signature') && (
                  <Link to="/parametres" className="underline">
                    Compléter mon profil
                  </Link>
                )}
              </span>
            </div>
          )}
          {template && <p className="text-[12px] text-ink-3">Modèle « {template.name} » · {labelOf(TEMPLATE_CATEGORIES, template.category)}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="mr-1 text-[12.5px] text-ink-3">Envoyer avec :</span>
            <a href={urls.gmail} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className={buttonClass('secondary', 'sm')}>
              <ExternalLink /> Gmail
            </a>
            <a href={urls.outlook} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className={buttonClass('secondary', 'sm')}>
              <ExternalLink /> Outlook web
            </a>
            <a href={urls.mailto} onClick={() => setOpened(true)} className={buttonClass('secondary', 'sm')}>
              <Mail /> Messagerie par défaut
            </a>
            <Button size="sm" variant="ghost" icon={<Copy />} onClick={copy}>
              Copier le texte
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
