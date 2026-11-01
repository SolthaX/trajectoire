// Client GitHub bas niveau : le dépôt privé de l'utilisateur sert de stockage
// (données synchronisées + documents). Tout passe par l'API REST (CORS autorisé).

import { useSyncExternalStore } from 'react';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

const KEY = 'trajectoire:github';
const listeners = new Set<() => void>();
let snapshotRaw: string | null = null;
let snapshot: RepoConfig | null = null;

function read(): RepoConfig | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === snapshotRaw) return snapshot;
  snapshotRaw = raw;
  try {
    const c = raw ? (JSON.parse(raw) as Partial<RepoConfig>) : null;
    snapshot = c?.token && c.owner && c.repo ? { owner: c.owner, repo: c.repo, branch: c.branch || 'main', token: c.token } : null;
  } catch {
    snapshot = null;
  }
  return snapshot;
}

export function getConfig(): RepoConfig | null {
  return read();
}

export function setConfig(c: RepoConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  read();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

export function useGithubConfig() {
  return useSyncExternalStore(subscribe, read);
}

export class GithubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// --- encodage ------------------------------------------------------------------
export const utf8 = {
  encode: (s: string) => new TextEncoder().encode(s),
  decode: (b: Uint8Array) => new TextDecoder().decode(b),
};

export function toBase64(bytes: Uint8Array) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export function fromBase64(b64: string) {
  const bin = atob(b64.replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- requêtes ------------------------------------------------------------------
const API = 'https://api.github.com';

function message(status: number, body: { message?: string } | null) {
  if (status === 401) return 'Jeton GitHub refusé (expiré ou invalide). Mettez-le à jour dans Paramètres.';
  if (status === 403) return body?.message?.includes('rate limit') ? 'Limite de requêtes GitHub atteinte, réessayez dans quelques minutes.' : "Le jeton GitHub n'a pas les droits nécessaires sur ce dépôt.";
  if (status === 404) return 'Dépôt ou fichier introuvable (vérifiez le nom du dépôt et les droits du jeton).';
  return `Erreur GitHub ${status}${body?.message ? ` : ${body.message}` : ''}`;
}

/**
 * Appel à l'API GitHub. Dans `path`, « {repo} » est remplacé par « repos/<owner>/<repo> ».
 * Jamais de cache navigateur (sinon l'arborescence reste périmée après un commit).
 */
export async function gh<T>(path: string, init: RequestInit = {}, cfg: RepoConfig | null = getConfig()): Promise<T> {
  if (!cfg) throw new GithubError('Dépôt GitHub non configuré (Paramètres → Synchronisation GitHub).', 0);
  const url = API + path.replace('{repo}', `repos/${cfg.owner}/${cfg.repo}`);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${cfg.token.trim()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new GithubError('GitHub injoignable (hors ligne ?).', 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new GithubError(message(res.status, body), res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const branchRef = (cfg: RepoConfig) => `heads/${encodeURIComponent(cfg.branch)}`;

export interface RepoInfo {
  full_name: string;
  private: boolean;
  default_branch: string;
  permissions?: { push?: boolean; pull?: boolean };
}

/** Vérifie l'accès au dépôt (lecture + écriture). */
export async function checkRepo(cfg: RepoConfig): Promise<RepoInfo> {
  const info = await gh<RepoInfo>('/{repo}', {}, cfg);
  if (info.permissions && !info.permissions.push) throw new GithubError("Le jeton n'a pas le droit d'écrire dans ce dépôt (Contents : Read and write).", 403);
  return info;
}

export interface Head {
  commitSha: string;
  treeSha: string;
}

/** Dernier commit de la branche (null si le dépôt est vide). */
export async function getHead(cfg = getConfig()): Promise<Head | null> {
  if (!cfg) throw new GithubError('Dépôt GitHub non configuré.', 0);
  try {
    const ref = await gh<{ object: { sha: string } }>(`/{repo}/git/ref/${branchRef(cfg)}`, {}, cfg);
    const commit = await gh<{ tree: { sha: string } }>(`/{repo}/git/commits/${ref.object.sha}`, {}, cfg);
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  } catch (e) {
    if (e instanceof GithubError && (e.status === 409 || e.status === 404)) return null;
    throw e;
  }
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

export interface Tree {
  commitSha: string | null;
  treeSha: string | null;
  entries: TreeEntry[];
}

/** Arborescence complète du dépôt au dernier commit. */
export async function getTree(cfg = getConfig()): Promise<Tree> {
  const head = await getHead(cfg);
  if (!head) return { commitSha: null, treeSha: null, entries: [] };
  const t = await gh<{ tree: TreeEntry[]; truncated: boolean }>(`/{repo}/git/trees/${head.treeSha}?recursive=1`, {}, cfg);
  return { commitSha: head.commitSha, treeSha: head.treeSha, entries: t.tree };
}

// Les blobs sont immuables (adressés par leur empreinte) : cache mémoire.
const blobCache = new Map<string, Uint8Array>();
let blobCacheSize = 0;

export async function readBlob(sha: string, cfg = getConfig()): Promise<Uint8Array> {
  const hit = blobCache.get(sha);
  if (hit) return hit;
  const b = await gh<{ content: string; encoding: string }>(`/{repo}/git/blobs/${sha}`, {}, cfg);
  const bytes = b.encoding === 'base64' ? fromBase64(b.content) : utf8.encode(b.content);
  blobCache.set(sha, bytes);
  blobCacheSize += bytes.length;
  while (blobCacheSize > 60_000_000 && blobCache.size > 1) {
    const [k, v] = blobCache.entries().next().value as [string, Uint8Array];
    blobCache.delete(k);
    blobCacheSize -= v.length;
  }
  return bytes;
}

export async function readText(sha: string, cfg = getConfig()) {
  return utf8.decode(await readBlob(sha, cfg));
}

/** Modification d'un fichier : contenu nouveau, réutilisation d'un blob existant, ou suppression (sha null). */
export type Change = { path: string; content: string | Uint8Array; mode?: string } | { path: string; sha: string | null; mode?: string };

/**
 * Crée un commit avec toutes les modifications d'un coup (API Git Data).
 * Rejoue automatiquement si la branche a bougé entre-temps (autre appareil, GitHub Actions).
 * Avec `opts.parent`, le commit est construit sur ce commit précis et n'est jamais rejoué :
 * si la branche a bougé, une GithubError 409 est levée (l'appelant refait sa fusion).
 * Renvoie l'empreinte du nouveau commit.
 */
export async function commit(
  changes: Change[],
  messageText: string,
  cfg = getConfig(),
  opts: { parent?: Head } = {},
): Promise<string> {
  if (!cfg) throw new GithubError('Dépôt GitHub non configuré.', 0);
  if (!changes.length) throw new Error('Aucune modification à enregistrer.');

  // Les blobs ne dépendent pas de la tête de branche : créés une seule fois.
  const entries: { path: string; mode: string; type: 'blob'; sha: string | null }[] = [];
  for (const ch of changes) {
    if ('content' in ch) {
      const bytes = typeof ch.content === 'string' ? utf8.encode(ch.content) : ch.content;
      const blob = await gh<{ sha: string }>('/{repo}/git/blobs', { method: 'POST', body: JSON.stringify({ content: toBase64(bytes), encoding: 'base64' }) }, cfg);
      blobCache.set(blob.sha, bytes);
      entries.push({ path: ch.path, mode: ch.mode ?? '100644', type: 'blob', sha: blob.sha });
    } else {
      entries.push({ path: ch.path, mode: ch.mode ?? '100644', type: 'blob', sha: ch.sha });
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const head = opts.parent ?? (await getHead(cfg));
    if (!head) {
      // Dépôt vide : l'API Git Data refuse, on crée le premier fichier via l'API Contents.
      const first = changes.find((c) => 'content' in c) as Extract<Change, { content: unknown }> | undefined;
      if (!first) throw new GithubError('Dépôt vide.', 409);
      const bytes = typeof first.content === 'string' ? utf8.encode(first.content) : first.content;
      await gh(`/{repo}/contents/${first.path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        body: JSON.stringify({ message: messageText, content: toBase64(bytes), branch: cfg.branch }),
      }, cfg);
      const rest = changes.filter((c) => c !== first);
      if (!rest.length) return (await getHead(cfg))!.commitSha;
      return commit(rest, messageText, cfg);
    }
    const tree = await gh<{ sha: string }>('/{repo}/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.treeSha, tree: entries }) }, cfg);
    const c = await gh<{ sha: string }>('/{repo}/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: messageText, tree: tree.sha, parents: [head.commitSha] }),
    }, cfg);
    try {
      await gh(`/{repo}/git/refs/${branchRef(cfg)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) }, cfg);
      return c.sha;
    } catch (e) {
      // 422 « not a fast forward » : quelqu'un a poussé entre-temps, on rejoue sur la nouvelle tête.
      if (e instanceof GithubError && e.status === 422 && opts.parent) throw new GithubError('La branche a changé pendant la synchronisation.', 409);
      if (e instanceof GithubError && e.status === 422 && attempt < 4) continue;
      throw e;
    }
  }
  throw new GithubError('Impossible de publier le commit (conflits répétés).', 409);
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null | string;
  html_url: string;
  created_at: string;
  head_sha: string;
}

/** Exécutions GitHub Actions déclenchées par un commit donné. */
export async function listRuns(headSha: string, cfg = getConfig()): Promise<WorkflowRun[]> {
  const r = await gh<{ workflow_runs: WorkflowRun[] }>(`/{repo}/actions/runs?head_sha=${headSha}&per_page=10`, {}, cfg);
  return r.workflow_runs;
}
