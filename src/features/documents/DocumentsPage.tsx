import { clsx } from 'clsx';
import { CircleAlert, FileCode2, FilePlus2, FolderOpen, FolderGit2, FolderPlus, Plus, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useBlocker, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { FileNode } from '../../../shared/types';
import { STARTER_CV_TEX } from './starter';
import { Button, ButtonLink, IconButton } from '../../components/ui/button';
import { Field, Input, Select } from '../../components/ui/form';
import { EmptyState, Loading, Spinner } from '../../components/ui/misc';
import { Dialog, Menu, useConfirm } from '../../components/ui/overlay';
import { errorMessage } from '../../lib/api';
import { useGithubConfig } from '../../lib/github';
import {
  basename,
  dirname,
  downloadFile,
  extname,
  filesApi,
  findNode,
  flattenFiles,
  joinPath,
  stem,
  uniqueName,
  useDocsSnapshot,
  useFileTree,
  useRefreshTree,
} from '../../lib/files';
import { FileTree, INTERNAL_DRAG, isFileDrag, type TreeAction } from './FileTree';
import { fileKind } from './fileTypes';
import { BLANK_TEX, letterDocument } from './letter';
import { LatexEditor } from './LatexEditor';
import { LetterEditor } from './LetterEditor';
import { initializeDocuments } from './latexRemote';
import { DocxViewer, ImageViewer, OtherViewer, PdfViewer, TextViewer } from './Viewers';
import './documents.css';

type DialogState =
  | { type: 'folder'; dir: string }
  | { type: 'letter'; dir: string }
  | { type: 'tex'; dir: string }
  | { type: 'rename'; node: FileNode };

const EXPANDED_KEY = 'documents.expanded';

function loadExpanded(): string[] | null {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

const isAffected = (selected: string | null, path: string) => !!selected && (selected === path || selected.startsWith(`${path}/`));

// ---------------------------------------------------------------------------------
// Point d'entrée : dépôt GitHub configuré ? dossier documents/ présent ?
// ---------------------------------------------------------------------------------
export default function DocumentsPage() {
  const cfg = useGithubConfig();
  const snap = useDocsSnapshot();
  const refreshTree = useRefreshTree();
  const [initializing, setInitializing] = useState(false);

  if (!cfg) {
    return (
      <EmptyState
        icon={<FolderGit2 />}
        title="Connectez votre dépôt GitHub dans Paramètres"
        description="Vos documents (CV LaTeX, lettres, PDF…) sont stockés dans votre dépôt GitHub privé, dans le dossier documents/. Les CV sont compilés en PDF par GitHub Actions."
        action={
          <ButtonLink to="/parametres" variant="primary">
            Ouvrir les paramètres
          </ButtonLink>
        }
      />
    );
  }
  if (snap.isLoading) return <Loading label="Lecture du dépôt GitHub…" />;
  if (snap.error || !snap.data) {
    return (
      <EmptyState
        icon={<CircleAlert />}
        title="Impossible de lire le dépôt GitHub"
        description={errorMessage(snap.error)}
        action={
          <Button icon={<RefreshCw />} onClick={() => void refreshTree()}>
            Réessayer
          </Button>
        }
      />
    );
  }
  if (!snap.data.hasRoot) {
    const init = async () => {
      setInitializing(true);
      try {
        const res = await initializeDocuments(!snap.data!.hasWorkflow);
        await refreshTree();
        toast.success(
          res.workflow || snap.data!.hasWorkflow
            ? 'Documents initialisés : le CV d’exemple se compile sur GitHub'
            : 'Documents initialisés (le workflow de compilation n’a pas pu être ajouté : droit « Workflows » manquant)',
          { duration: 8000 },
        );
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setInitializing(false);
      }
    };
    return (
      <EmptyState
        icon={<FolderOpen />}
        title="Aucun document dans le dépôt"
        description={`Le dépôt ${cfg.owner}/${cfg.repo} ne contient pas encore de dossier documents/. Initialisez-le avec un CV LaTeX d'exemple, une lettre modèle et les dossiers CV, Lettres et Divers.`}
        action={
          <Button variant="primary" icon={initializing ? <Spinner className="size-3.5 text-bg" /> : <Sparkles />} disabled={initializing} onClick={() => void init()}>
            Initialiser les documents
          </Button>
        }
      />
    );
  }
  return <DocumentsWorkspace />;
}

/** Pendant qu'une écriture part sur GitHub (un commit), on affiche une notification d'attente. */
async function withCommitToast<T>(pending: string, success: string | ((r: T) => string), fn: () => Promise<T>): Promise<T | undefined> {
  const id = toast.loading(pending);
  try {
    const r = await fn();
    toast.success(typeof success === 'function' ? success(r) : success, { id });
    return r;
  } catch (e) {
    toast.error(errorMessage(e), { id });
    return undefined;
  }
}

function DocumentsWorkspace() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('path');
  const tree = useFileTree();
  const refreshTree = useRefreshTree();
  const confirm = useConfirm();
  const nodes = useMemo(() => tree.data ?? [], [tree.data]);

  // --- modifications non enregistrées ------------------------------------------
  const dirtyRef = useRef(false);
  const [dirty, setDirtyState] = useState(false);
  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
    setDirtyState(d);
  }, []);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirtyRef.current) return false;
    if (currentLocation.pathname !== nextLocation.pathname) return true;
    const cur = new URLSearchParams(currentLocation.search).get('path');
    const next = new URLSearchParams(nextLocation.search).get('path');
    return cur !== next;
  });

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: 'Modifications non enregistrées',
      message: 'Le document ouvert contient des modifications non enregistrées. Les abandonner ?',
      confirmLabel: 'Abandonner les modifications',
      danger: true,
    }).then((ok) => {
      if (ok) {
        setDirty(false);
        blocker.proceed?.();
      } else blocker.reset?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const open = useCallback(
    (path: string | null) =>
      setParams((p) => {
        if (path) p.set('path', path);
        else p.delete('path');
        return p;
      }),
    [setParams],
  );

  // --- dossiers dépliés --------------------------------------------------------
  const [expandedList, setExpandedList] = useState<string[] | null>(loadExpanded);
  const expanded = useMemo(() => new Set(expandedList ?? []), [expandedList]);
  useEffect(() => {
    if (expandedList === null && tree.data) setExpandedList(tree.data.filter((n) => n.type === 'dir').map((n) => n.path));
  }, [expandedList, tree.data]);
  useEffect(() => {
    if (expandedList === null) return;
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedList));
    } catch {
      /* stockage indisponible */
    }
  }, [expandedList]);
  const expand = useCallback((...paths: string[]) => {
    setExpandedList((list) => {
      const set = new Set(list ?? []);
      for (const p of paths.filter(Boolean)) {
        // déplie aussi tous les dossiers parents
        const parts = p.split('/');
        for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('/'));
      }
      return [...set];
    });
  }, []);
  const toggle = (path: string) => {
    setTargetDir(path);
    setExpandedList((list) => {
      const set = new Set(list ?? []);
      if (set.has(path)) set.delete(path);
      else set.add(path);
      return [...set];
    });
  };
  useEffect(() => {
    if (selected && dirname(selected)) expand(dirname(selected));
  }, [selected, expand]);

  // Dossier cible des créations / imports : dossier cliqué ou dossier du fichier ouvert.
  const [targetDir, setTargetDir] = useState(() => (selected ? dirname(selected) : ''));
  const validTarget = targetDir && findNode(nodes, targetDir)?.type === 'dir' ? targetDir : '';

  // --- actions -------------------------------------------------------------------
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadDir = useRef('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [rootDrag, setRootDrag] = useState(false);

  const upload = async (dir: string, files: File[]) => {
    if (!files.length) return;
    const id = toast.loading(`Import de ${files.length} fichier${files.length > 1 ? 's' : ''} sur GitHub…`);
    try {
      const res = await filesApi.upload(dir, files);
      if (dir) expand(dir);
      toast.success(`${res.paths.length} fichier${res.paths.length > 1 ? 's importés' : ' importé'}`, { id });
      if (res.paths.length === 1) open(res.paths[0]);
    } catch (e) {
      toast.error(errorMessage(e), { id });
    }
  };

  const moveTo = async (from: string, toDir: string) => {
    if (dirname(from) === toDir || from === toDir || toDir.startsWith(`${from}/`)) return;
    const to = joinPath(toDir, basename(from));
    if (isAffected(selected, from) && dirtyRef.current) {
      toast.error("Enregistrez le document ouvert avant de le déplacer.");
      return;
    }
    const done = await withCommitToast('Déplacement…', `Déplacé dans ${toDir || 'Documents'}`, () => filesApi.move(from, to));
    if (!done) return;
    expand(toDir);
    if (isAffected(selected, from)) open(to + selected!.slice(from.length));
  };

  const onDrop = (dir: string, e: DragEvent) => {
    const internal = e.dataTransfer.getData(INTERNAL_DRAG);
    if (internal) void moveTo(internal, dir);
    else if (e.dataTransfer.files.length) void upload(dir, [...e.dataTransfer.files]);
  };

  const onAction = async (action: TreeAction, node: FileNode) => {
    const dir = node.type === 'dir' ? node.path : dirname(node.path);
    switch (action) {
      case 'new-letter':
        return setDialog({ type: 'letter', dir });
      case 'new-tex':
        return setDialog({ type: 'tex', dir });
      case 'new-folder':
        return setDialog({ type: 'folder', dir });
      case 'upload':
        uploadDir.current = dir;
        return fileInput.current?.click();
      case 'rename':
        return setDialog({ type: 'rename', node });
      case 'download':
        void downloadFile(node.path).catch((e) => toast.error(errorMessage(e)));
        return;
      case 'duplicate': {
        const ext = node.type === 'file' ? extname(node.name) : '';
        const name = node.type === 'file' ? `${stem(node.name)} (copie)${ext}` : `${node.name} (copie)`;
        const to = uniqueName(nodes, dirname(node.path), name);
        await withCommitToast('Copie…', `Copie créée : ${basename(to)}`, () => filesApi.copy(node.path, to));
        return;
      }
      case 'delete': {
        const ok = await confirm({
          title: node.type === 'dir' ? 'Mettre ce dossier à la corbeille ?' : 'Mettre ce fichier à la corbeille ?',
          message: (
            <>
              <strong className="font-medium text-ink">{node.name}</strong>
              {node.type === 'dir' ? ' et tout son contenu seront déplacés' : ' sera déplacé'} dans le dossier caché{' '}
              <code className="font-mono text-[12px]">documents/.corbeille</code>. Vous pourrez l'y récupérer.
            </>
          ),
          confirmLabel: 'Mettre à la corbeille',
          danger: true,
        });
        if (!ok) return;
        const done = await withCommitToast('Mise à la corbeille…', 'Déplacé dans la corbeille', () => filesApi.remove(node.path));
        if (done && isAffected(selected, node.path)) {
          setDirty(false);
          open(null);
        }
        return;
      }
    }
  };

  const select = (node: FileNode) => {
    setTargetDir(dirname(node.path));
    if (node.path !== selected) open(node.path);
  };

  // --- visionneuse ---------------------------------------------------------------
  const selectedNode = selected ? findNode(nodes, selected) : undefined;
  let viewer: ReactNode;
  if (!selected) {
    viewer = (
      <EmptyState
        icon={<FolderOpen />}
        title="Choisissez un document"
        description="Les CV LaTeX se compilent en PDF, les lettres s'éditent comme dans un traitement de texte. Glissez-déposez des fichiers depuis l'explorateur Windows pour les importer."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<FilePlus2 />} onClick={() => setDialog({ type: 'letter', dir: validTarget || 'Lettres' })}>
              Nouvelle lettre
            </Button>
            <Button
              icon={<Upload />}
              onClick={() => {
                uploadDir.current = validTarget;
                fileInput.current?.click();
              }}
            >
              Importer
            </Button>
          </div>
        }
      />
    );
  } else if (tree.data && (!selectedNode || selectedNode.type !== 'file')) {
    viewer = (
      <EmptyState
        icon={<CircleAlert />}
        title="Fichier introuvable"
        description={`« ${selected} » n'existe plus ou a été déplacé.`}
        action={<Button onClick={() => open(null)}>Fermer</Button>}
      />
    );
  } else {
    const kind = fileKind(selected);
    viewer =
      kind === 'tex' ? (
        <LatexEditor key={selected} path={selected} onDirtyChange={setDirty} />
      ) : kind === 'letter' ? (
        <LetterEditor key={selected} path={selected} onDirtyChange={setDirty} />
      ) : kind === 'text' ? (
        <TextViewer key={selected} path={selected} onDirtyChange={setDirty} />
      ) : kind === 'docx' ? (
        <DocxViewer key={selected} path={selected} onOpen={open} />
      ) : kind === 'pdf' ? (
        <PdfViewer key={selected} path={selected} />
      ) : kind === 'image' ? (
        <ImageViewer key={selected} path={selected} />
      ) : (
        <OtherViewer key={selected} path={selected} />
      );
  }

  // Lorsque l'on change de fichier, l'état « modifié » repart de zéro.
  useEffect(() => setDirty(false), [selected, setDirty]);

  return (
    <div className="flex h-full min-h-0">
      {/* Arborescence */}
      <aside
        className={clsx('relative flex w-[264px] shrink-0 flex-col border-r border-line bg-bg', rootDrag && 'bg-accent-soft/40')}
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setRootDrag(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootDrag(false);
        }}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setRootDrag(false);
          onDrop('', e);
        }}
      >
        <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-line px-3">
          <h1 className="flex-1 text-[14px] font-semibold tracking-tight text-ink">Documents</h1>
          <IconButton label="Recharger depuis GitHub" onClick={() => void refreshTree()} disabled={tree.isFetching}>
            <RefreshCw className={clsx(tree.isFetching && 'animate-spin')} />
          </IconButton>
          <IconButton
            label="Importer des fichiers"
            onClick={() => {
              uploadDir.current = validTarget;
              fileInput.current?.click();
            }}
          >
            <Upload />
          </IconButton>
          <Menu
            align="end"
            width="min-w-[220px]"
            header={`Dans ${validTarget || 'Documents'}`}
            trigger={
              <Button size="sm" variant="secondary" icon={<Plus />}>
                Nouveau
              </Button>
            }
            items={[
              { label: 'Lettre', icon: <FilePlus2 />, onSelect: () => setDialog({ type: 'letter', dir: validTarget }) },
              { label: 'Fichier LaTeX (.tex)', icon: <FileCode2 />, onSelect: () => setDialog({ type: 'tex', dir: validTarget }) },
              { label: 'Dossier', icon: <FolderPlus />, onSelect: () => setDialog({ type: 'folder', dir: validTarget }) },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" onClick={(e) => e.target === e.currentTarget && setTargetDir('')}>
          {tree.isLoading ? (
            <Loading />
          ) : tree.error ? (
            <p className="px-2 py-4 text-[12.5px] text-danger">{errorMessage(tree.error)}</p>
          ) : nodes.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12.5px] text-ink-3">Dossier vide. Glissez des fichiers ici.</p>
          ) : (
            <FileTree nodes={nodes} selected={selected} expanded={expanded} onToggle={toggle} onSelect={select} onAction={onAction} onDrop={onDrop} />
          )}
        </div>
        <div className="shrink-0 border-t border-line px-3 py-2 text-[11.5px] leading-snug text-ink-3">
          {flattenFiles(nodes).length} fichiers · glisser-déposer pour importer
        </div>
        {rootDrag && (
          <div className="pointer-events-none absolute inset-2 flex items-end justify-center rounded-xl border-2 border-dashed border-accent/50 pb-12">
            <span className="rounded-md bg-surface px-2.5 py-1 text-[12px] font-medium text-accent-ink shadow-sm">Déposer pour importer</span>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            void upload(uploadDir.current, files);
          }}
        />
      </aside>

      {/* Visionneuse / éditeur */}
      <section className="min-w-0 flex-1 bg-surface">{viewer}</section>

      <NameDialog
        state={dialog}
        nodes={nodes}
        onClose={() => setDialog(null)}
        onDone={async (created, { renamedFrom, isDir } = {}) => {
          if (renamedFrom) {
            if (isAffected(selected, renamedFrom)) open(created + selected!.slice(renamedFrom.length));
          } else if (isDir) {
            expand(created);
            setTargetDir(created);
          } else {
            if (dirname(created)) expand(dirname(created));
            open(created);
          }
        }}
        dirtyOpen={(path) => isAffected(selected, path) && dirtyRef.current}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Fenêtre de création / renommage
// ---------------------------------------------------------------------------------
function NameDialog({
  state,
  nodes,
  onClose,
  onDone,
  dirtyOpen,
}: {
  state: DialogState | null;
  nodes: FileNode[];
  onClose: () => void;
  onDone: (path: string, opts?: { renamedFrom?: string; isDir?: boolean }) => Promise<void>;
  dirtyOpen: (path: string) => boolean;
}) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const allFiles = useMemo(() => flattenFiles(nodes), [nodes]);
  const letters = allFiles.filter((f) => fileKind(f.path) === 'letter');
  const texFiles = allFiles.filter((f) => fileKind(f.path) === 'tex');

  useEffect(() => {
    if (!state) return;
    setError('');
    setBusy(false);
    if (state.type === 'rename') setName(state.node.name);
    else if (state.type === 'letter') {
      setName('');
      const modele = letters.find((l) => /mod[eè]le/i.test(l.name));
      setSource(modele?.path ?? '');
    } else if (state.type === 'tex') {
      setName('');
      setSource('__cv__');
    } else setName('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state) return <Dialog open={false} onOpenChange={() => {}} title="" />;

  const dir = state.type === 'rename' ? dirname(state.node.path) : state.dir;
  const ext = state.type === 'letter' ? '.html' : state.type === 'tex' ? '.tex' : '';
  const titles = {
    folder: 'Nouveau dossier',
    letter: 'Nouvelle lettre',
    tex: 'Nouveau fichier LaTeX',
    rename: `Renommer « ${state.type === 'rename' ? state.node.name : ''} »`,
  };

  const submit = async () => {
    let n = name.trim();
    if (!n) return setError('Le nom est obligatoire');
    if (/[\\/]/.test(n)) return setError('Le nom ne doit pas contenir de « / » ni de « \\ »');
    if (n.startsWith('.')) return setError('Le nom ne doit pas commencer par un point');
    if (/[<>:"|?*]/.test(n)) return setError('Caractères interdits : < > : " | ? *');
    if (ext && extname(n) !== ext) n += ext;
    // Renommage d'un fichier : l'extension d'origine est conservée si on l'a effacée.
    if (state.type === 'rename' && state.node.type === 'file' && !extname(n) && extname(state.node.name)) n += extname(state.node.name);
    const target = joinPath(dir, n);
    const exists = findNode(nodes, target);
    const isSelf = state.type === 'rename' && state.node.path.toLowerCase() === target.toLowerCase();
    if (exists && !isSelf) return setError('Un élément porte déjà ce nom dans ce dossier');
    setBusy(true);
    try {
      if (state.type === 'folder') {
        await filesApi.mkdir(target);
        await onDone(target, { isDir: true });
      } else if (state.type === 'rename') {
        if (state.node.path === target) return onClose();
        if (dirtyOpen(state.node.path)) {
          setBusy(false);
          return setError('Enregistrez le document ouvert avant de le renommer.');
        }
        await filesApi.move(state.node.path, target);
        await onDone(target, { renamedFrom: state.node.path });
      } else if (state.type === 'letter') {
        if (source) await filesApi.copy(source, target);
        else await filesApi.saveText(target, letterDocument('<p></p>', stem(n)));
        await onDone(target);
      } else {
        if (source === '__cv__') await filesApi.saveText(target, STARTER_CV_TEX);
        else if (source === '__blank__') await filesApi.saveText(target, BLANK_TEX);
        else await filesApi.copy(source, target);
        await onDone(target);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={titles[state.type]}
      description={state.type === 'rename' ? undefined : `Dans ${dir ? dir.split('/').join(' / ') : 'Documents'}`}
      size="sm"
      onSubmit={() => void submit()}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {state.type === 'rename' ? 'Renommer' : 'Créer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom" error={error} hint={ext ? `L'extension ${ext} est ajoutée automatiquement.` : undefined}>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder={state.type === 'letter' ? 'ex. Lettre Acme - Chef de projet' : state.type === 'tex' ? 'ex. cv-2026' : 'Nom du dossier'}
              autoComplete="off"
              onFocus={(e) => {
                // Sélectionne le nom sans l'extension lors d'un renommage.
                if (state.type === 'rename' && state.node.type === 'file') {
                  const dot = e.target.value.lastIndexOf('.');
                  if (dot > 0) e.target.setSelectionRange(0, dot);
                }
              }}
            />
          )}
        </Field>
        {state.type === 'letter' && (
          <Field label="Partir de" hint="Les {{variables}} de la lettre de départ sont conservées.">
            {(id) => (
              <Select
                id={id}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                options={[{ value: '', label: 'Page blanche' }, ...letters.map((l) => ({ value: l.path, label: l.path }))]}
              />
            )}
          </Field>
        )}
        {state.type === 'tex' && (
          <Field label="Partir de">
            {(id) => (
              <Select
                id={id}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                options={[
                  { value: '__cv__', label: 'Modèle de CV (sobre, une page)' },
                  { value: '__blank__', label: 'Document vide' },
                  ...texFiles.map((f) => ({ value: f.path, label: `Copie de ${f.path}` })),
                ]}
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  );
}
