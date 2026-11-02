import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { FileNode } from '../../shared/types';
import { setFileIndex } from '../backend/fileIndex';
import { commit, getConfig, gh, getTree, readBlob, readText, useGithubConfig, type Change, type RepoConfig, type Tree } from './github';

// Module Documents : les fichiers vivent dans le dépôt GitHub privé, sous « documents/ ».
// Les chemins manipulés par l'app sont relatifs à ce dossier (séparateur « / »).
// Chaque action (enregistrer, importer, renommer…) produit un commit unique.
// Toutes les clés de cache commencent par « files » (exclues du rafraîchissement global).

export const DOCS_ROOT = 'documents';
const TRASH = '.corbeille';
const KEEP = '.gitkeep';
/** Journaux de compilation écrits par GitHub Actions : .latex/<chemin sans .tex>.log */
export const LATEX_LOG_ROOT = '.latex';
export const LATEX_WORKFLOW_PATH = '.github/workflows/latex.yml';

export class FilesError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Nœud de l'arborescence, avec l'empreinte git du fichier (sha). */
export interface DocNode extends FileNode {
  sha?: string;
  children?: DocNode[];
}

interface BlobInfo {
  sha: string;
  size: number;
  mode: string;
}

export interface DocsSnapshot {
  commitSha: string | null;
  /** Le dossier documents/ existe dans le dépôt. */
  hasRoot: boolean;
  /** Le workflow de compilation LaTeX est présent. */
  hasWorkflow: boolean;
  /** Arborescence visible (sans éléments cachés). */
  nodes: DocNode[];
  /** Tous les fichiers sous documents/, cachés compris (chemin relatif → blob). */
  files: Map<string, BlobInfo>;
  /** Tous les dossiers sous documents/ (chemins relatifs). */
  dirs: Set<string>;
  /** Journaux de compilation (chemin relatif à .latex/ → sha). */
  logs: Map<string, string>;
}

export interface TextFile {
  path: string;
  content: string;
  mtime: number;
  sha: string;
}

export interface CompileResult {
  ok: boolean;
  pdf: string | null;
  log: string;
}

export interface LatexStatus {
  available: boolean;
  version: string | null;
  bin: string;
}

// --- utilitaires de chemins ----------------------------------------------------

export const basename = (p: string) => p.split('/').pop() ?? p;
export const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
export const extname = (p: string) => {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i).toLowerCase() : '';
};
export const stem = (p: string) => {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
};
export const joinPath = (...parts: string[]) => parts.filter(Boolean).join('/');
const repoPath = (rel: string) => joinPath(DOCS_ROOT, rel);
const isHidden = (rel: string) => rel.split('/').some((s) => s.startsWith('.'));

/** Normalise un chemin saisi (pas de « .. », pas d'éléments cachés, pas de caractères interdits). */
function cleanRel(rel: string, opts: { allowRoot?: boolean } = {}): string {
  const parts = rel.replace(/\\/g, '/').split('/').filter((p) => p !== '' && p !== '.');
  for (const p of parts) {
    if (p === '..') throw new FilesError(400, 'Chemin invalide');
    if (p.startsWith('.')) throw new FilesError(403, 'Élément caché non accessible');
    if (/[\0<>:"|?*]/.test(p)) throw new FilesError(400, `Caractère interdit dans « ${p} »`);
  }
  const out = parts.join('/');
  if (!out && !opts.allowRoot) throw new FilesError(400, 'Chemin manquant');
  return out;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html;charset=utf-8',
  '.htm': 'text/html;charset=utf-8',
  '.txt': 'text/plain;charset=utf-8',
  '.md': 'text/plain;charset=utf-8',
  '.tex': 'text/plain;charset=utf-8',
  '.cls': 'text/plain;charset=utf-8',
  '.sty': 'text/plain;charset=utf-8',
  '.bib': 'text/plain;charset=utf-8',
  '.log': 'text/plain;charset=utf-8',
  '.csv': 'text/csv;charset=utf-8',
  '.json': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};
export const mimeOf = (path: string) => MIME[extname(path)] ?? 'application/octet-stream';

// --- instantané du dépôt -------------------------------------------------------

function buildSnapshot(tree: Tree): DocsSnapshot {
  const prefix = `${DOCS_ROOT}/`;
  const logPrefix = `${LATEX_LOG_ROOT}/`;
  const files = new Map<string, BlobInfo>();
  const dirs = new Set<string>();
  const logs = new Map<string, string>();
  let hasRoot = false;
  let hasWorkflow = false;
  for (const e of tree.entries) {
    if (e.path === DOCS_ROOT && e.type === 'tree') hasRoot = true;
    else if (e.path === LATEX_WORKFLOW_PATH) hasWorkflow = true;
    else if (e.path.startsWith(prefix)) {
      const rel = e.path.slice(prefix.length);
      if (e.type === 'blob') files.set(rel, { sha: e.sha, size: e.size ?? 0, mode: e.mode });
      else if (e.type === 'tree') dirs.add(rel);
    } else if (e.path.startsWith(logPrefix) && e.type === 'blob') {
      logs.set(e.path.slice(logPrefix.length), e.sha);
    }
  }

  // Arborescence visible : dossiers d'abord, tri alphabétique français.
  const byPath = new Map<string, DocNode>();
  const roots: DocNode[] = [];
  const attach = (node: DocNode) => {
    const parent = dirname(node.path);
    if (!parent) roots.push(node);
    else byPath.get(parent)?.children?.push(node);
  };
  for (const d of [...dirs].filter((d) => !isHidden(d)).sort((a, b) => a.split('/').length - b.split('/').length)) {
    const node: DocNode = { name: basename(d), path: d, type: 'dir', children: [] };
    byPath.set(d, node);
    attach(node);
  }
  for (const [rel, info] of files) {
    if (isHidden(rel)) continue;
    attach({ name: basename(rel), path: rel, type: 'file', size: info.size, sha: info.sha });
  }
  const sort = (list: DocNode[]) => {
    list.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : collator.compare(a.name, b.name)));
    for (const n of list) if (n.children) sort(n.children);
  };
  sort(roots);

  return { commitSha: tree.commitSha, hasRoot, hasWorkflow, nodes: roots, files, dirs, logs };
}

let latest: DocsSnapshot | null = null;
let latestKey = '';
let queryClient: QueryClient | null = null;

const cfgKey = (cfg: RepoConfig | null) => (cfg ? `${cfg.owner}/${cfg.repo}@${cfg.branch}` : 'aucun');
const treeKey = (cfg: RepoConfig | null) => ['files', 'tree', cfgKey(cfg)] as const;

/** Relit l'arborescence sur GitHub et met à jour le cache partagé. */
export async function fetchSnapshot(): Promise<DocsSnapshot> {
  const cfg = getConfig();
  const snap = buildSnapshot(await getTree(cfg));
  latest = snap;
  latestKey = cfgKey(cfg);
  setFileIndex([...snap.files.keys()].filter((p) => !isHidden(p)));
  queryClient?.setQueryData(treeKey(cfg), snap);
  return snap;
}

async function current(): Promise<DocsSnapshot> {
  return latest && latestKey === cfgKey(getConfig()) ? latest : fetchSnapshot();
}

/** Après une écriture : on recharge l'arborescence (les nouveaux blobs sont déjà en cache). */
async function commitAndSync(changes: Change[], message: string) {
  const sha = await commit(changes, message);
  await fetchSnapshot();
  return sha;
}

function blobsUnder(snap: DocsSnapshot, rel: string) {
  const out: [string, BlobInfo][] = [];
  for (const [p, info] of snap.files) if (p === rel || p.startsWith(`${rel}/`)) out.push([p, info]);
  return out;
}

const exists = (snap: DocsSnapshot, rel: string) => snap.files.has(rel) || snap.dirs.has(rel);

/** Si un dossier se retrouve vide après l'opération, on y laisse un .gitkeep (git ne garde pas les dossiers vides). */
function keepParent(snap: DocsSnapshot, removed: Set<string>, parent: string, changes: Change[]) {
  if (!parent || isHidden(parent)) return;
  const remaining = [...snap.files.keys()].some((p) => p.startsWith(`${parent}/`) && !removed.has(p));
  const added = changes.some((c) => 'path' in c && c.path.startsWith(`${repoPath(parent)}/`) && !('sha' in c && c.sha === null));
  if (!remaining && !added) changes.push({ path: repoPath(joinPath(parent, KEEP)), content: '' });
}

function kindLabel(path: string) {
  const ext = extname(path);
  if (ext === '.html' || ext === '.htm') return { label: 'Lettre', created: 'Nouvelle lettre' };
  if (ext === '.tex') return { label: 'LaTeX', created: 'Nouveau fichier LaTeX' };
  return { label: 'Fichier', created: 'Nouveau fichier' };
}

function uniqueIn(snap: DocsSnapshot, rel: string, taken: Set<string>) {
  const lower = new Set([...snap.files.keys(), ...snap.dirs, ...taken].map((p) => p.toLowerCase()));
  if (!lower.has(rel.toLowerCase())) return rel;
  const dir = dirname(rel);
  const ext = extname(rel);
  const base = stem(rel).replace(/ \(\d+\)$/, '');
  for (let i = 2; i < 1000; i++) {
    const candidate = joinPath(dir, `${base} (${i})${ext}`);
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  throw new FilesError(409, 'Impossible de trouver un nom libre');
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}m${pad(d.getSeconds())}s`;
}

async function resolveFile(rel: string): Promise<BlobInfo> {
  let snap = await current();
  let info = snap.files.get(rel);
  if (!info) {
    snap = await fetchSnapshot();
    info = snap.files.get(rel);
  }
  if (!info) throw new FilesError(404, 'Fichier introuvable');
  return info;
}

async function loadMammoth() {
  const mod = await import('mammoth');
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

// --- API -------------------------------------------------------------------------

export const filesApi = {
  tree: async () => (await fetchSnapshot()).nodes,

  async text(path: string): Promise<TextFile> {
    const rel = cleanRel(path);
    const info = await resolveFile(rel);
    return { path: rel, content: await readText(info.sha), mtime: 0, sha: info.sha };
  },

  async saveText(path: string, content: string, opts: { message?: string } = {}) {
    const rel = cleanRel(path);
    const snap = await current();
    if (snap.dirs.has(rel)) throw new FilesError(400, "Ce n'est pas un fichier");
    const k = kindLabel(rel);
    const message = opts.message ?? `${snap.files.has(rel) ? k.label : k.created} : ${basename(rel)}`;
    const changes: Change[] = [{ path: repoPath(rel), content }];
    // Un .gitkeep devenu inutile dans le dossier est retiré au passage.
    const keep = joinPath(dirname(rel), KEEP);
    if (snap.files.has(keep)) changes.push({ path: repoPath(keep), sha: null });
    const commitSha = await commitAndSync(changes, message);
    return { ok: true, mtime: Date.now(), commit: commitSha };
  },

  async mkdir(path: string) {
    const rel = cleanRel(path);
    const snap = await fetchSnapshot();
    if (exists(snap, rel)) throw new FilesError(409, 'Un élément porte déjà ce nom');
    await commitAndSync([{ path: repoPath(joinPath(rel, KEEP)), content: '' }], `Nouveau dossier : ${rel}`);
    return { ok: true, path: rel };
  },

  async move(from: string, to: string) {
    const src = cleanRel(from);
    const dst = cleanRel(to);
    if (src === dst) return { ok: true, path: dst };
    if (dst.startsWith(`${src}/`)) throw new FilesError(400, 'Impossible de déplacer un dossier dans lui-même');
    const snap = await fetchSnapshot();
    const blobs = blobsUnder(snap, src);
    if (!blobs.length) throw new FilesError(404, 'Élément introuvable');
    const caseOnly = src.toLowerCase() === dst.toLowerCase();
    if (exists(snap, dst) && !caseOnly) throw new FilesError(409, 'Un élément porte déjà ce nom');
    const changes: Change[] = [];
    const removed = new Set<string>();
    for (const [p, info] of blobs) {
      changes.push({ path: repoPath(dst + p.slice(src.length)), sha: info.sha, mode: info.mode });
      changes.push({ path: repoPath(p), sha: null });
      removed.add(p);
    }
    keepParent(snap, removed, dirname(src), changes);
    const message =
      dirname(src) === dirname(dst) ? `Renommage : ${src} → ${basename(dst)}` : `Déplacement : ${src} → ${dirname(dst) || 'documents'}/`;
    await commitAndSync(changes, message);
    return { ok: true, path: dst };
  },

  async copy(from: string, to: string) {
    const src = cleanRel(from);
    const dst = cleanRel(to);
    if (dst.startsWith(`${src}/`)) throw new FilesError(400, 'Impossible de copier un dossier dans lui-même');
    const snap = await fetchSnapshot();
    const blobs = blobsUnder(snap, src);
    if (!blobs.length) throw new FilesError(404, 'Élément introuvable');
    if (exists(snap, dst)) throw new FilesError(409, 'Un élément porte déjà ce nom');
    const changes: Change[] = blobs.map(([p, info]) => ({ path: repoPath(dst + p.slice(src.length)), sha: info.sha, mode: info.mode }));
    await commitAndSync(changes, `Copie : ${src} → ${basename(dst)}`);
    return { ok: true, path: dst };
  },

  /** Mise à la corbeille : déplacement dans documents/.corbeille/ (horodaté), jamais de suppression définitive. */
  async remove(path: string) {
    const src = cleanRel(path);
    const snap = await fetchSnapshot();
    const blobs = blobsUnder(snap, src);
    if (!blobs.length) throw new FilesError(404, 'Élément introuvable');
    const target = uniqueIn(snap, joinPath(TRASH, `${stamp()}_${basename(src)}`), new Set());
    const changes: Change[] = [];
    const removed = new Set<string>();
    for (const [p, info] of blobs) {
      changes.push({ path: repoPath(target + p.slice(src.length)), sha: info.sha, mode: info.mode });
      changes.push({ path: repoPath(p), sha: null });
      removed.add(p);
    }
    keepParent(snap, removed, dirname(src), changes);
    await commitAndSync(changes, `Corbeille : ${src}`);
    return { ok: true, path: src, trashed: basename(target) };
  },

  async upload(dir: string, files: File[]) {
    const base = cleanRel(dir, { allowRoot: true });
    if (!files.length) throw new FilesError(400, 'Aucun fichier reçu');
    const snap = await fetchSnapshot();
    if (base && snap.files.has(base)) throw new FilesError(400, "Ce n'est pas un dossier");
    const taken = new Set<string>();
    const changes: Change[] = [];
    const paths: string[] = [];
    for (const f of files) {
      const name = basename(f.name.replace(/\\/g, '/')).replace(/[\0<>:"|?*]/g, '_').replace(/^\.+/, '') || 'fichier';
      const rel = uniqueIn(snap, joinPath(base, name), taken);
      taken.add(rel);
      paths.push(rel);
      changes.push({ path: repoPath(rel), content: new Uint8Array(await f.arrayBuffer()) });
    }
    const keep = joinPath(base, KEEP);
    if (base && snap.files.has(keep)) changes.push({ path: repoPath(keep), sha: null });
    await commitAndSync(changes, files.length === 1 ? `Import : ${paths[0]}` : `Import de ${files.length} fichiers dans ${base || 'documents'}/`);
    return { paths };
  },

  async docxHtml(path: string) {
    const rel = cleanRel(path);
    if (extname(rel) !== '.docx') throw new FilesError(400, 'Seuls les fichiers .docx sont pris en charge');
    const bytes = await readBlob((await resolveFile(rel)).sha);
    const mammoth = await loadMammoth();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return { html: result.value, messages: result.messages.map((m: { message: string }) => m.message) };
  },

  /** Contenu brut d'un fichier. */
  async bytes(path: string) {
    return readBlob((await resolveFile(cleanRel(path))).sha);
  },

  /** Journal de compilation produit par GitHub Actions pour un .tex (ou null). */
  async latexLog(texPath: string): Promise<string | null> {
    const snap = await current();
    const sha = snap.logs.get(latexLogPath(texPath));
    return sha ? readText(sha) : null;
  },

  /** Commit d'un ou plusieurs fichiers en une fois (création de contenu initial…). */
  async writeMany(files: { path: string; content: string }[], message: string, extra: Change[] = []) {
    const changes: Change[] = [...files.map((f) => ({ path: repoPath(cleanRel(f.path)), content: f.content })), ...extra];
    return commitAndSync(changes, message);
  },
};

// --- compilation rapide (service en ligne) ------------------------------------------

/** Service de compilation LaTeX en ligne (TeX Live complet). Le dossier du .tex y est envoyé. */
export const FAST_LATEX_URL = 'https://latex.ytotech.com/builds/sync';
const TEXT_EXT = new Set(['.tex', '.cls', '.sty', '.bib', '.bst', '.bbx', '.cbx', '.lbx', '.def', '.cfg', '.txt', '.csv']);
const MAX_UPLOAD = 15 * 1024 * 1024;

function toB64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export type FastCompileResult = { ok: true; seconds: number; log: string } | { ok: false; log: string };

/**
 * Compile `texPath` (contenu courant `content`) via le service en ligne, avec les fichiers de son dossier
 * (images, .cls, .bib…). En cas de succès, enregistre le .tex, le PDF et le journal en un seul commit
 * marqué [skip ci] (GitHub Actions ne recompile donc pas).
 */
export async function compileFast(texPath: string, content: string): Promise<FastCompileResult> {
  const rel = cleanRel(texPath);
  const dir = dirname(rel);
  const pdfRel = rel.replace(/\.tex$/i, '.pdf');
  const snap = await fetchSnapshot();
  const resources: Record<string, unknown>[] = [{ path: basename(rel), main: true, content }];
  let total = content.length;
  for (const [p, info] of snap.files) {
    if (p === rel || p === pdfRel || isHidden(p)) continue;
    if (dir && !p.startsWith(`${dir}/`)) continue;
    const local = dir ? p.slice(dir.length + 1) : p;
    total += info.size;
    if (total > MAX_UPLOAD) throw new FilesError(400, 'Dossier trop volumineux pour la compilation rapide (15 Mo max) : utilisez GitHub.');
    const bytes = await readBlob(info.sha);
    resources.push(TEXT_EXT.has(extname(p)) ? { path: local, content: new TextDecoder().decode(bytes) } : { path: local, file: toB64(bytes) });
  }
  const debut = Date.now();
  let res: Response;
  try {
    res = await fetch(FAST_LATEX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compiler: 'xelatex', resources }),
    });
  } catch {
    throw new FilesError(400, 'Service de compilation rapide injoignable : réessayez ou passez sur GitHub dans les Paramètres.');
  }
  const seconds = Math.round((Date.now() - debut) / 100) / 10;
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const type = res.headers.get('content-type') ?? '';
  if (res.ok && type.includes('pdf')) {
    const pdf = new Uint8Array(await res.arrayBuffer());
    const log = `# Compilation réussie — ${repoPath(rel)} — ${date} UTC — ${seconds} s (compilation rapide)\n`;
    const changes: Change[] = [
      { path: repoPath(rel), content },
      { path: repoPath(pdfRel), content: pdf },
      { path: joinPath(LATEX_LOG_ROOT, latexLogPath(rel)), content: log },
    ];
    await commitAndSync(changes, `PDF compilé (rapide) : ${basename(rel)} [skip ci]`);
    return { ok: true, seconds, log };
  }
  let detail = '';
  try {
    const body = (await res.json()) as { error?: string; log_files?: Record<string, string> };
    const logs = Object.values(body.log_files ?? {}).join('\n');
    // On ne garde que les lignes utiles (erreurs « ! » et « fichier:ligne: »).
    const lines = logs.split('\n');
    const useful = lines.filter((l, i) => /^!|^\S+\.tex:\d+:/.test(l) || (i > 0 && /^!/.test(lines[i - 1])));
    detail = (useful.length ? useful.join('\n') : logs.slice(-4000)) || body.error || '';
    detail = detail.replaceAll('__main_document__.tex', basename(rel));
  } catch {
    detail = `Réponse inattendue du service (HTTP ${res.status}).`;
  }
  return { ok: false, log: `# Compilation échec — ${repoPath(rel)} — ${date} UTC — ${seconds} s (compilation rapide)\n${detail}` };
}

/** Chemin du journal (relatif à .latex/) pour un .tex relatif à documents/. */
export const latexLogPath = (texPath: string) => `${texPath.replace(/\.tex$/i, '')}.log`;

/** Déclenche le workflow de compilation à la main (aucune modification à pousser). */
export async function dispatchLatex(texPath: string) {
  const cfg = getConfig();
  if (!cfg) throw new FilesError(400, 'Dépôt GitHub non configuré');
  await gh(`/{repo}/actions/workflows/latex.yml/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: cfg.branch, inputs: { fichier: repoPath(cleanRel(texPath)) } }),
  });
}

/** Ajoute (ou remplace) un fichier hors du dossier documents/ (workflow…). */
export async function writeRepoFile(path: string, content: string, message: string) {
  return commitAndSync([{ path, content }], message);
}

export async function downloadFile(path: string) {
  const bytes = await filesApi.bytes(path);
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeOf(path) }));
  const a = document.createElement('a');
  a.href = url;
  a.download = basename(path);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const fileKeys = {
  all: ['files'] as const,
  tree: ['files', 'tree'] as const,
  text: (path: string) => ['files', 'text', path] as const,
  docx: (path: string) => ['files', 'docx', path] as const,
  blob: (sha: string) => ['files', 'blob', sha] as const,
  latexStatus: ['files', 'latex-status'] as const,
};

// --- hooks -------------------------------------------------------------------------

/** Instantané complet du dépôt (arborescence + métadonnées). */
export function useDocsSnapshot() {
  const cfg = useGithubConfig();
  queryClient = useQueryClient();
  return useQuery({
    queryKey: treeKey(cfg),
    queryFn: fetchSnapshot,
    enabled: !!cfg,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useFileTree() {
  const cfg = useGithubConfig();
  queryClient = useQueryClient();
  return useQuery({
    queryKey: treeKey(cfg),
    queryFn: fetchSnapshot,
    enabled: !!cfg,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    retry: 1,
    select: (s: DocsSnapshot) => s.nodes,
  });
}

/** Contenu texte d'un fichier : chargé une fois, jamais rafraîchi en arrière-plan. */
export function useFileText(path: string | null) {
  return useQuery({
    queryKey: fileKeys.text(path ?? ''),
    queryFn: () => filesApi.text(path!),
    enabled: !!path,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * URL locale (blob:) d'un fichier du dépôt, avec le bon type MIME.
 * Se met à jour quand le fichier change (nouveau sha) et se libère toute seule.
 */
export function useFileBlobUrl(path: string | null) {
  const snap = useDocsSnapshot();
  const info = path ? snap.data?.files.get(path) : undefined;
  const sha = info?.sha ?? null;
  const q = useQuery({
    queryKey: fileKeys.blob(sha ?? ''),
    queryFn: () => readBlob(sha!),
    enabled: !!sha,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: 1,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data || !path) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(new Blob([q.data as Uint8Array<ArrayBuffer>], { type: mimeOf(path) }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [q.data, path]);
  return {
    url,
    sha,
    size: info?.size,
    exists: !!info,
    isLoading: snap.isLoading || (!!sha && (q.isLoading || !url)),
    error: q.error,
  };
}

/** « Compilation disponible » = dépôt GitHub configuré (la compilation se fait par GitHub Actions). */
export function useLatexStatus(): { data: LatexStatus } {
  const cfg = useGithubConfig();
  return { data: { available: !!cfg, version: cfg ? 'GitHub Actions' : null, bin: 'github-actions' } };
}

export function useRefreshTree() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: fileKeys.tree }), [qc]);
}

// --- utilitaires d'arborescence --------------------------------------------------------

/** Liste à plat de tous les fichiers (pour les sélecteurs de documents). */
export function flattenFiles<T extends FileNode>(nodes: T[] = []): T[] {
  const out: T[] = [];
  const walk = (list: T[]) => {
    for (const n of list) {
      if (n.type === 'file') out.push(n);
      else walk((n.children ?? []) as T[]);
    }
  };
  walk(nodes);
  return out;
}

export function findNode<T extends FileNode>(nodes: T[] = [], path: string): T | undefined {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.type === 'dir' && path.startsWith(`${n.path}/`)) return findNode((n.children ?? []) as T[], path);
  }
  return undefined;
}

/** Nom libre dans un dossier : « nom.ext », sinon « nom (2).ext », etc. */
export function uniqueName(nodes: FileNode[] = [], dir: string, name: string) {
  const siblings = dir ? (findNode(nodes, dir)?.children ?? []) : nodes;
  const taken = new Set(siblings.map((n) => n.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return joinPath(dir, name);
  const ext = extname(name);
  const base = ext ? name.slice(0, -ext.length) : name;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return joinPath(dir, candidate);
  }
  return joinPath(dir, `${base}-${Date.now()}${ext}`);
}
