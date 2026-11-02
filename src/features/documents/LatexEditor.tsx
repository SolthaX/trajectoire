import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ChevronDown, CircleAlert, CircleCheck, Download, ExternalLink, Play, Save, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, IconButton } from '../../components/ui/button';
import { Segmented } from '../../components/ui/form';
import { EmptyState, Kbd, Loading, Spinner } from '../../components/ui/misc';
import { errorMessage, useSettings } from '../../lib/api';
import {
  compileFast,
  dispatchLatex,
  downloadFile,
  fetchSnapshot,
  fileKeys,
  filesApi,
  latexLogPath,
  useDocsSnapshot,
  useFileBlobUrl,
  useFileText,
} from '../../lib/files';
import type { WorkflowRun } from '../../lib/github';
import { CodeEditor } from './CodeEditor';
import { installLatexWorkflow, parseLogHeader, waitForLatexRun } from './latexRemote';
import { SaveStatus, useSaveShortcut, ViewerHeader, type SaveState } from './shared';

type Layout = 'split' | 'code' | 'pdf';

type Phase =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'fast'; startedAt: number }
  | { kind: 'waiting'; status: 'pending' | 'queued' | 'in_progress'; startedAt: number; runUrl?: string };

interface CompileLog {
  ok: boolean;
  text: string;
  runUrl?: string;
}

export function LatexEditor({ path, onDirtyChange }: { path: string; onDirtyChange: (dirty: boolean) => void }) {
  const file = useFileText(path);
  if (file.isLoading) return <Loading />;
  if (file.error || !file.data)
    return <EmptyState icon={<CircleAlert />} title="Impossible d'ouvrir ce fichier" description={errorMessage(file.error)} />;
  return <LatexEditorInner path={path} initial={file.data.content} onDirtyChange={onDirtyChange} />;
}

function LogLine({ line }: { line: string }) {
  const t = line.trim();
  const isError = /^(error|!)/i.test(t) || /^# Compilation échec/.test(t);
  const isWarning = /^warning/i.test(t);
  const isHeader = /^# Compilation réussie/.test(t);
  return (
    <div
      className={clsx(
        isError && 'font-medium text-danger',
        isWarning && 'text-warning-ink',
        isHeader && 'font-medium text-success',
        !isError && !isWarning && !isHeader && 'text-ink-3',
      )}
    >
      {line || ' '}
    </div>
  );
}

function phaseLabel(phase: Phase, now: number) {
  if (phase.kind === 'saving') return 'Enregistrement sur GitHub…';
  if (phase.kind === 'fast') return `Compilation rapide… ${Math.max(0, Math.round((now - phase.startedAt) / 1000))} s`;
  if (phase.kind !== 'waiting') return '';
  const s = Math.max(0, Math.round((now - phase.startedAt) / 1000));
  if (phase.status === 'pending') return `Envoi à GitHub Actions… ${s} s`;
  if (phase.status === 'queued') return `En file d'attente sur GitHub… ${s} s`;
  return `Compilation sur GitHub… ${s} s`;
}

function LatexEditorInner({ path, initial, onDirtyChange }: { path: string; initial: string; onDirtyChange: (d: boolean) => void }) {
  const qc = useQueryClient();
  const snapshot = useDocsSnapshot();
  const { data: settings } = useSettings();
  const fast = settings?.latex_engine === 'rapide';
  const [code, setCode] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<CompileLog | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>('split');
  const [installing, setInstalling] = useState(false);
  // Composant toujours monté ? (remis à true au montage : le mode strict de React démonte/remonte une fois)
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const pdfPath = path.replace(/\.tex$/i, '.pdf');
  const pdf = useFileBlobUrl(pdfPath);
  const dirty = code !== saved;
  const busy = phase.kind !== 'idle';
  const saveState: SaveState = saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const workflowMissing = snapshot.data && !fast ? !snapshot.data.hasWorkflow : false;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Chronomètre affiché pendant l'attente de GitHub Actions.
  useEffect(() => {
    if (phase.kind !== 'waiting' && phase.kind !== 'fast') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  /** Enregistre (un commit) ; renvoie l'empreinte du commit, ou null si rien à enregistrer / échec. */
  const save = async (message?: string): Promise<string | null | false> => {
    if (!dirty) return null;
    const content = code;
    setSaving(true);
    try {
      const res = await filesApi.saveText(path, content, message ? { message } : {});
      setSaved(content);
      qc.setQueryData(fileKeys.text(path), { path, content, mtime: res.mtime, sha: '' });
      return res.commit;
    } catch (e) {
      toast.error(`Enregistrement impossible : ${errorMessage(e)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Compilation par le service en ligne : quelques secondes, PDF enregistré dans le dépôt. */
  const compileFastNow = async () => {
    setLog(null);
    const startedAt = Date.now();
    setNow(startedAt);
    setPhase({ kind: 'fast', startedAt });
    const content = code;
    try {
      const result = await compileFast(path, content);
      if (!alive.current) return;
      if (result.ok) {
        setSaved(content);
        qc.setQueryData(fileKeys.text(path), { path, content, mtime: Date.now(), sha: '' });
        setLog({ ok: true, text: result.log });
        setLogOpen(false);
        if (layout === 'code') setLayout('split');
        toast.success(`PDF à jour (${result.seconds} s)`);
      } else {
        // Échec : le .tex est quand même enregistré, sans relancer GitHub Actions.
        await save(`LaTeX : ${path.split('/').pop()} [skip ci]`);
        setLog({ ok: false, text: result.log });
        setLogOpen(true);
        toast.error('La compilation a échoué — voir le journal');
      }
    } catch (e) {
      if (!alive.current) return;
      setLog({ ok: false, text: errorMessage(e) });
      setLogOpen(true);
      toast.error(errorMessage(e));
    } finally {
      if (alive.current) setPhase({ kind: 'idle' });
    }
  };

  const compile = async () => {
    if (busy) return;
    if (fast) return compileFastNow();
    if (workflowMissing) {
      if (dirty) await save();
      toast.error('Installez d’abord le workflow de compilation (bandeau en haut).');
      return;
    }
    setLog(null);
    setPhase(dirty ? { kind: 'saving' } : { kind: 'waiting', status: 'pending', startedAt: Date.now() });
    const logKey = latexLogPath(path);
    const logShaBefore = snapshot.data?.logs.get(logKey);
    try {
      let sha: string;
      let since: number | undefined;
      const committed = await save();
      if (committed === false) return setPhase({ kind: 'idle' });
      if (committed) sha = committed;
      else {
        // Rien de nouveau à pousser : lancement manuel du workflow pour ce fichier.
        const head = await fetchSnapshot();
        if (!head.commitSha) throw new Error('Dépôt vide');
        sha = head.commitSha;
        since = Date.now();
        await dispatchLatex(path);
      }
      const startedAt = Date.now();
      setNow(startedAt);
      setPhase({ kind: 'waiting', status: 'pending', startedAt });
      const result = await waitForLatexRun({
        sha,
        since,
        isCancelled: () => !alive.current,
        onProgress: (run: WorkflowRun | null) =>
          alive.current &&
          setPhase({
            kind: 'waiting',
            status: !run ? 'pending' : run.status === 'queued' || run.status === 'waiting' || run.status === 'requested' ? 'queued' : 'in_progress',
            startedAt,
            runUrl: run?.html_url,
          }),
      });
      if (!alive.current || result.outcome === 'cancelled') return;

      if (result.outcome === 'no-run') {
        setLog({
          ok: false,
          text: "Aucune exécution GitHub Actions n'a démarré. Vérifiez que le workflow « Compilation LaTeX » est présent et activé dans l'onglet Actions du dépôt.",
        });
        setLogOpen(true);
        toast.error('GitHub Actions ne s’est pas déclenché');
        return;
      }
      if (result.outcome === 'timeout') {
        setLog({
          ok: false,
          text: 'La compilation prend plus de 5 minutes. Elle continue peut-être sur GitHub : rechargez la page plus tard.',
          runUrl: result.run?.html_url,
        });
        setLogOpen(true);
        return;
      }

      // Terminé : on recharge l'arborescence (nouveau PDF + journal poussés par le workflow).
      const snap = await fetchSnapshot();
      const logSha = snap.logs.get(logKey);
      const text = logSha ? ((await filesApi.latexLog(path)) ?? '') : '';
      const header = logSha && logSha !== logShaBefore ? parseLogHeader(text) : null;
      const ok = header ? header.ok : result.run.conclusion === 'success';
      setLog({
        ok,
        text: text || (ok ? '' : `L'exécution GitHub s'est terminée avec le statut « ${result.run.conclusion ?? 'inconnu'} ».`),
        runUrl: result.run.html_url,
      });
      if (ok) {
        setLogOpen(false);
        if (layout === 'code') setLayout('split');
        toast.success('PDF à jour');
      } else {
        setLogOpen(true);
        toast.error('La compilation a échoué — voir le journal');
      }
    } catch (e) {
      if (!alive.current) return;
      setLog({ ok: false, text: errorMessage(e) });
      setLogOpen(true);
      toast.error(errorMessage(e));
    } finally {
      if (alive.current) setPhase({ kind: 'idle' });
    }
  };

  useSaveShortcut(() => void compile());

  const installWorkflow = async () => {
    setInstalling(true);
    try {
      await installLatexWorkflow();
      toast.success('Workflow de compilation installé dans le dépôt');
    } catch (e) {
      toast.error(errorMessage(e), { duration: 10000 });
    } finally {
      setInstalling(false);
    }
  };

  const errorCount = log ? log.text.split('\n').filter((l) => /^(error|!)/i.test(l.trim())).length : 0;
  const label = phaseLabel(phase, now);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path} status={<SaveStatus state={saveState} />}>
        <Segmented
          size="sm"
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'code', label: 'Source' },
            { value: 'split', label: 'Côte à côte' },
            { value: 'pdf', label: 'PDF' },
          ]}
          className="mr-1 hidden md:inline-flex"
        />
        <IconButton label="Enregistrer sans compiler" onClick={() => void save()} disabled={!dirty || saving || busy}>
          <Save />
        </IconButton>
        {pdf.exists && (
          <>
            <IconButton label="Ouvrir le PDF dans un onglet" disabled={!pdf.url} onClick={() => pdf.url && window.open(pdf.url, '_blank')}>
              <ExternalLink />
            </IconButton>
            <IconButton
              label="Télécharger le PDF"
              onClick={() => void downloadFile(pdfPath).catch((e) => toast.error(errorMessage(e)))}
            >
              <Download />
            </IconButton>
          </>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => void compile()}
          disabled={busy || workflowMissing}
          icon={busy ? <Spinner className="size-3.5 text-on-brand" /> : <Play />}
          title={
            workflowMissing
              ? 'Installez le workflow de compilation'
              : fast
                ? 'Enregistrer et compiler avec le service rapide (Ctrl+S) — modifiable dans les Paramètres'
                : 'Enregistrer et compiler sur GitHub (Ctrl+S) — compilation rapide possible dans les Paramètres'
          }
        >
          {busy ? 'Compilation…' : fast ? 'Compiler (rapide)' : 'Compiler'}
          {!busy && <span className="ml-1 hidden text-[11px] font-normal opacity-60 xl:inline">Ctrl S</span>}
        </Button>
      </ViewerHeader>

      {workflowMissing && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-warning-soft px-4 py-2.5 text-[12.5px] text-warning-ink">
          <TriangleAlert className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            La compilation se fait par GitHub Actions, mais le workflow <code className="font-mono text-[12px]">latex.yml</code> n'est pas
            encore dans votre dépôt.
          </div>
          <Button size="sm" onClick={() => void installWorkflow()} disabled={installing} icon={installing ? <Spinner className="size-3.5" /> : undefined}>
            Installer le workflow
          </Button>
        </div>
      )}

      <div className={clsx('grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]', layout === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
        {/* Source */}
        <div className={clsx('flex min-h-0 min-w-0 flex-col', layout === 'pdf' && 'hidden', layout === 'split' && 'md:border-r md:border-line')}>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeEditor value={code} onChange={setCode} language="latex" />
          </div>
          {log && (
            <div className="shrink-0 border-t border-line bg-surface">
              <div className="flex h-9 items-center gap-2 px-4">
                <button
                  onClick={() => setLogOpen((o) => !o)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-[12.5px] font-medium text-ink-2 hover:text-ink"
                >
                  {log.ok ? <CircleCheck className="size-4 shrink-0 text-success" /> : <CircleAlert className="size-4 shrink-0 text-danger" />}
                  <span className="truncate">
                    {log.ok
                      ? 'Compilation réussie'
                      : `Échec de la compilation${errorCount ? ` · ${errorCount} erreur${errorCount > 1 ? 's' : ''}` : ''}`}
                  </span>
                  <ChevronDown className={clsx('ml-auto size-4 shrink-0 text-ink-3 transition-transform', logOpen && 'rotate-180')} />
                </button>
                {log.runUrl && (
                  <a
                    href={log.runUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] text-accent-ink hover:underline"
                  >
                    Exécution GitHub <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              {logOpen && (
                <pre className="max-h-[38vh] overflow-auto border-t border-line bg-surface-2/60 px-4 py-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                  {log.text ? log.text.split('\n').map((l, i) => <LogLine key={i} line={l} />) : <span className="text-ink-3">Aucun message.</span>}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Aperçu PDF */}
        <div className={clsx('relative min-h-0 min-w-0 bg-surface-2', layout === 'code' && 'hidden', layout === 'split' && 'hidden md:block')}>
          {pdf.exists ? (
            pdf.url ? (
              <iframe key={pdf.url} title="Aperçu PDF" src={`${pdf.url}#view=FitH`} className="absolute inset-0 size-full border-0" />
            ) : (
              <Loading label="Chargement du PDF…" />
            )
          ) : (
            <EmptyState
              icon={<Play />}
              title="Pas encore de PDF"
              description={
                <>
                  Compilez le document : GitHub Actions produit le PDF à côté du fichier. <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> enregistre et compile.
                </>
              }
              action={
                <Button
                  variant="primary"
                  onClick={() => void compile()}
                  disabled={busy || workflowMissing}
                  icon={busy ? <Spinner className="size-3.5 text-bg" /> : <Play />}
                >
                  Compiler
                </Button>
              }
            />
          )}
          {busy && (
            <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-surface/95 px-4 py-2 text-[12.5px] text-ink-2 backdrop-blur">
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-3.5" /> {label}
              </span>
              {phase.kind === 'waiting' && phase.runUrl && (
                <a href={phase.runUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                  Voir sur GitHub <ExternalLink className="size-3" />
                </a>
              )}
              {phase.kind === 'waiting' && phase.status !== 'in_progress' && (
                <span className="w-full text-center text-[11.5px] text-ink-3">Compter 30 s à 1 min (la première compilation est plus longue).</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
