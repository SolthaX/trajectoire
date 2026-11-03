// Synchronisation des données avec le dépôt GitHub privé (fichier trajectoire.json).
// Principe (comme Benkyō) : chaque ligne porte sa date de modification, la plus récente
// l'emporte ; les suppressions sont mémorisées (tombstones) pour se propager.

import { useSyncExternalStore } from 'react';
import { commit, getConfig, getTree, GithubError, readText, type Head } from '../lib/github';
import { exportSnapshot, importSnapshot, now, TABLES, type Snapshot } from './db';

export const DATA_FILE = 'trajectoire.json';

/**
 * Version du schéma des données. Une version plus ancienne de l'app ne connaît pas les nouvelles
 * tables / colonnes et les effacerait en poussant : elle refuse donc de synchroniser.
 * 3 : événements de networking, entreprises secondaires des contacts, type d'entreprise.
 */
export const SCHEMA_VERSION = 3;

// --- état observable ----------------------------------------------------------------
export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error' | 'offline';
  lastSync: string | null;
  error: string | null;
}

let status: SyncStatus = { state: getConfig() ? 'idle' : 'off', lastSync: null, error: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// --- fusion ----------------------------------------------------------------------------
type Row = Record<string, any>;

const keyOf = (table: string, r: Row) => (table === 'settings' ? r.key : r.id);

/** Fusion déterministe : même résultat quel que soit l'appareil qui la calcule. */
export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const tomb = new Map<string, string>();
  for (const t of [...(a.tombstones ?? []), ...(b.tombstones ?? [])]) {
    const k = `${t.tbl}:${t.id}`;
    if (!tomb.has(k) || t.deleted_at > tomb.get(k)!) tomb.set(k, t.deleted_at);
  }
  const tables: Snapshot['tables'] = {};
  for (const t of TABLES) {
    const map = new Map<unknown, Row>();
    for (const r of [...(a.tables[t] ?? []), ...(b.tables[t] ?? [])]) {
      const k = keyOf(t, r);
      const prev = map.get(k);
      if (!prev) {
        map.set(k, r);
        continue;
      }
      const ru = String(r.updated_at ?? '');
      const pu = String(prev.updated_at ?? '');
      // À date égale, départage stable sur le contenu (évite les allers-retours entre appareils).
      if (ru > pu || (ru === pu && JSON.stringify(r) > JSON.stringify(prev))) map.set(k, r);
    }
    tables[t] = [...map.values()]
      .filter((r) => t === 'settings' || !((tomb.get(`${t}:${r.id}`) ?? '') >= String(r.updated_at ?? '￿')))
      .sort((x, y) => (keyOf(t, x) < keyOf(t, y) ? -1 : 1));
  }
  const tombstones = [...tomb.entries()]
    .map(([k, deleted_at]) => {
      const i = k.indexOf(':');
      return { tbl: k.slice(0, i), id: Number(k.slice(i + 1)), deleted_at };
    })
    .sort((x, y) => (x.tbl === y.tbl ? x.id - y.id : x.tbl < y.tbl ? -1 : 1));
  return { tables, tombstones };
}

const canon = (s: Snapshot) => JSON.stringify({ tables: s.tables, tombstones: s.tombstones });

// --- branchements fournis par app.ts -----------------------------------------------------
let changeCounter = 0;
let persist: () => Promise<void> = async () => {};
let onDataChanged: () => void = () => {};

export function configureSync(opts: { persist: () => Promise<void>; onDataChanged: () => void }) {
  persist = opts.persist;
  onDataChanged = opts.onDataChanged;
}

/** Appelé après chaque modification locale. */
export function noteLocalChange() {
  changeCounter++;
  scheduleSync();
}

// --- synchro ------------------------------------------------------------------------------
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;

export function scheduleSync(delay = 4000) {
  if (!getConfig()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Tire, fusionne, pousse. Les appels concurrents partagent la même exécution. */
export function syncNow(): Promise<void> {
  if (!getConfig()) {
    setStatus({ state: 'off', error: null });
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ state: 'syncing', error: null });
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (await syncOnce()) break;
      }
      setStatus({ state: 'idle', lastSync: now(), error: null });
    } catch (e) {
      const offline = e instanceof GithubError && e.status === 0;
      setStatus({ state: offline ? 'offline' : 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
      if (again) {
        again = false;
        scheduleSync(500);
      }
    }
  })();
  return running;
}

/** Une passe de synchro. Renvoie false s'il faut recommencer (modif locale ou distante entre-temps). */
async function syncOnce(): Promise<boolean> {
  const startCounter = changeCounter;
  const tree = await getTree();
  const entry = tree.entries.find((e) => e.path === DATA_FILE);
  let remote: Snapshot | null = null;
  if (entry) {
    const parsed = JSON.parse(await readText(entry.sha)) as Partial<Snapshot> & { app?: string; schema?: number };
    if (parsed.app !== 'trajectoire') throw new Error(`${DATA_FILE} ne vient pas de Trajectoire.`);
    if ((parsed.schema ?? 2) > SCHEMA_VERSION) {
      throw new Error('Les données en ligne viennent d’une version plus récente de Trajectoire : rechargez la page pour mettre l’app à jour.');
    }
    remote = { tables: parsed.tables ?? {}, tombstones: parsed.tombstones ?? [] };
  }

  const local = exportSnapshot();
  const merged = remote ? mergeSnapshots(local, remote) : local;
  if (canon(merged) !== canon(local)) {
    // Une modification locale est arrivée pendant le téléchargement : on recommence.
    if (changeCounter !== startCounter) return false;
    importSnapshot(merged);
    await persist();
    onDataChanged();
  }

  const final = exportSnapshot();
  if (remote && canon(final) === canon(remote)) return true;
  if (changeCounter !== startCounter) return false;

  const parent: Head | undefined = tree.commitSha && tree.treeSha ? { commitSha: tree.commitSha, treeSha: tree.treeSha } : undefined;
  const body = JSON.stringify({ app: 'trajectoire', version: 2, schema: SCHEMA_VERSION, updated_at: now(), ...final }, null, 1);
  try {
    await commit([{ path: DATA_FILE, content: body }], 'Synchronisation des données', getConfig(), parent ? { parent } : {});
  } catch (e) {
    // Quelqu'un a poussé entre-temps (autre appareil, compilation LaTeX) : on refait la fusion.
    if (e instanceof GithubError && e.status === 409) return false;
    throw e;
  }
  return true;
}
