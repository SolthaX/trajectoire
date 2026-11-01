import { clsx } from 'clsx';
import { Check, FileText, FilePlus2, Link2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Job } from '../../../shared/types';
import { SearchInput, matches } from '../../components/table';
import { Button, IconButton } from '../../components/ui/button';
import { Field, Input, Select } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { errorMessage, useItem, useSave, useSettings } from '../../lib/api';
import { basename, filesApi, flattenFiles, useFileTree } from '../../lib/files';
import { useGithubConfig } from '../../lib/github';
import { buildVariables, fillTemplateHtml } from '../../lib/template';

/** Liste à plat des documents du dépôt GitHub (vide si GitHub n'est pas configuré). */
export function useFileList() {
  const { data } = useFileTree();
  return useMemo(() => flattenFiles(data ?? []), [data]);
}

function NotConnected() {
  return (
    <p className="py-6 text-center text-[13px] text-ink-3">
      Les documents sont stockés dans votre dépôt GitHub.{' '}
      <Link to="/parametres" className="text-accent-ink hover:underline">
        Connectez-le dans Paramètres
      </Link>
      .
    </p>
  );
}

const docHref = (path: string) => `/documents?path=${encodeURIComponent(path)}`;

function PickDocumentDialog({ open, onOpenChange, job }: { open: boolean; onOpenChange: (o: boolean) => void; job: Job }) {
  const files = useFileList();
  const github = useGithubConfig();
  const save = useSave('jobs');
  const [q, setQ] = useState('');
  const linked = new Set(job.documents ?? []);
  const toggle = (path: string) => {
    const next = linked.has(path) ? [...linked].filter((p) => p !== path) : [...linked, path];
    save.mutate({ id: job.id, documents: next });
  };
  const rows = files.filter((f) => matches(q, f.path));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Lier des documents" description="CV, lettre, portfolio… envoyés pour cette candidature." size="md">
      <SearchInput value={q} onChange={setQ} placeholder="Rechercher un fichier…" className="mb-3 w-full" />
      {!github ? (
        <NotConnected />
      ) : files.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-3">
          Aucun fichier.{' '}
          <Link to="/documents" className="text-accent-ink hover:underline">
            Ouvrir les documents
          </Link>
        </p>
      ) : (
        <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
          {rows.map((f) => (
            <li key={f.path}>
              <button
                onClick={() => toggle(f.path)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                  linked.has(f.path) ? 'bg-accent-soft text-ink' : 'hover:bg-surface-2',
                )}
              >
                <FileText className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate">{f.path}</span>
                {linked.has(f.path) && <Check className="size-4 text-accent-ink" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function slug(s: string) {
  return s
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function CreateLetterDialog({ open, onOpenChange, job }: { open: boolean; onOpenChange: (o: boolean) => void; job: Job }) {
  const files = useFileList();
  const github = useGithubConfig();
  const navigate = useNavigate();
  const save = useSave('jobs');
  const { data: settings } = useSettings();
  const { data: contact } = useItem('contacts', job.contact_id);
  const letters = files.filter((f) => f.name.toLowerCase().endsWith('.html'));
  const [base, setBase] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const defaultName = `Lettres/${slug(`${job.company_name ? `${job.company_name} - ` : ''}${job.title}`)}.html`;
  const chosenBase = base || letters.find((l) => /mod[eè]le/i.test(l.name))?.path || letters[0]?.path || '';
  const target = name || defaultName;

  const create = async () => {
    if (!chosenBase) return;
    setBusy(true);
    try {
      const { content } = await filesApi.text(chosenBase);
      const vars = buildVariables({ job, contact, profile: settings?.profile, companyName: job.company_name });
      const { text, missing } = fillTemplateHtml(content, vars);
      // Pas d'écrasement : suffixe (2), (3)… si le nom existe déjà.
      const existing = new Set(files.map((f) => f.path));
      let path = target.endsWith('.html') ? target : `${target}.html`;
      for (let i = 2; existing.has(path); i++) path = path.replace(/( \(\d+\))?\.html$/, ` (${i}).html`);
      // Un seul commit sur le dépôt GitHub.
      await filesApi.saveText(path, text, { message: `Lettre : ${basename(path)}` });
      await save.mutateAsync({ id: job.id, documents: [...new Set([...(job.documents ?? []), path])] });
      toast.success(missing.length ? `Lettre créée · à compléter : ${missing.map((m) => `{{${m}}}`).join(', ')}` : 'Lettre créée');
      onOpenChange(false);
      navigate(docHref(path));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Créer une lettre de motivation"
      description="Copie une lettre existante en remplaçant les variables ({{entreprise}}, {{poste}}, {{date}}…), puis l'ouvre dans l'éditeur."
      size="md"
      onSubmit={create}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={busy || !chosenBase || !github}>
            {busy ? 'Création sur GitHub…' : 'Créer et ouvrir'}
          </Button>
        </>
      }
    >
      {!github ? (
        <NotConnected />
      ) : letters.length === 0 ? (
        <p className="text-[13px] text-ink-3">
          Aucune lettre modèle (.html) dans vos documents.{' '}
          <Link to="/documents" className="text-accent-ink hover:underline">
            Créez-en une dans Documents
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Lettre de départ">
            {(id) => (
              <Select id={id} value={chosenBase} onChange={(e) => setBase(e.target.value)} options={letters.map((l) => ({ value: l.path, label: l.path }))} />
            )}
          </Field>
          <Field label="Nom du nouveau fichier">{(id) => <Input id={id} value={target} onChange={(e) => setName(e.target.value)} />}</Field>
        </div>
      )}
    </Dialog>
  );
}

export function JobDocuments({ job }: { job: Job }) {
  const save = useSave('jobs');
  const [pickOpen, setPickOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const docs = job.documents ?? [];
  return (
    <div>
      {docs.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {docs.map((p) => (
            <li key={p} className="group flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
              <FileText className="size-3.5 shrink-0 text-ink-3" />
              <Link to={docHref(p)} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-accent-ink hover:underline" title={p}>
                {p.split('/').pop()}
              </Link>
              <IconButton
                label="Retirer"
                size="xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => save.mutate({ id: job.id, documents: docs.filter((d) => d !== p) })}
              >
                <X className="!size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[13px] text-ink-3">Aucun document lié.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<FilePlus2 />} onClick={() => setLetterOpen(true)}>
          Créer une lettre
        </Button>
        <Button size="sm" variant="ghost" icon={<Link2 />} onClick={() => setPickOpen(true)}>
          Lier un fichier
        </Button>
      </div>
      <PickDocumentDialog open={pickOpen} onOpenChange={setPickOpen} job={job} />
      <CreateLetterDialog open={letterOpen} onOpenChange={setLetterOpen} job={job} />
    </div>
  );
}
