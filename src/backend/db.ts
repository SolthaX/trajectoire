// Base SQLite en mémoire (WebAssembly), dans le navigateur.
// La persistance est assurée par store.ts (IndexedDB) et la synchro par sync.ts (GitHub).

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { DEFAULT_CRITERIA, DEFAULT_TEMPLATES } from './seed';

type Row = Record<string, any>;
type SqlValue = string | number | null | bigint | Uint8Array;

// Instance créée par initDb() ; typée simplement pour rester lisible.
let db: {
  exec: (opts: string | { sql: string; bind?: SqlValue[] }) => unknown;
  selectObjects: (sql: string, bind?: SqlValue[]) => Row[];
  selectValue: (sql: string, bind?: SqlValue[]) => unknown;
  changes: () => number;
};

/** Tables synchronisées, dans l'ordre des dépendances (parents d'abord). */
export const TABLES = ['companies', 'contacts', 'projects', 'jobs', 'interviews', 'interactions', 'events', 'templates', 'criteria', 'settings'] as const;
export type TableName = (typeof TABLES)[number];

const stamps = `created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''`;

const SCHEMA = `
  CREATE TABLE companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    linkedin TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'a_explorer',
    priority TEXT NOT NULL DEFAULT 'moyenne',
    locations TEXT NOT NULL DEFAULT '[]',
    -- entreprise / reseau (association, communauté) / ecole
    kind TEXT NOT NULL DEFAULT 'entreprise',
    -- « Mes réseaux » : j'en fais partie, avec quel rôle (ex. shifter)
    member INTEGER NOT NULL DEFAULT 0,
    my_role TEXT NOT NULL DEFAULT '',
    ${stamps}
  );
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'en_cours',
    summary TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '[]',
    start_date TEXT,
    end_date TEXT,
    scores TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    ${stamps}
  );
  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    civility TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    linkedin TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'non_contacte',
    priority TEXT NOT NULL DEFAULT 'moyenne',
    next_followup TEXT,
    source TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    -- Autres entreprises que company_id (l'entreprise principale) : [{ company_id, role }]
    affiliations TEXT NOT NULL DEFAULT '[]',
    ${stamps}
  );
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    contract TEXT NOT NULL DEFAULT '',
    remote TEXT NOT NULL DEFAULT '',
    salary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'a_etudier',
    priority TEXT NOT NULL DEFAULT 'moyenne',
    deadline TEXT,
    applied_at TEXT,
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    documents TEXT NOT NULL DEFAULT '[]',
    ${stamps}
  );
  CREATE TABLE interviews (
    id INTEGER PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    scheduled_at TEXT NOT NULL,
    duration INTEGER,
    kind TEXT NOT NULL DEFAULT 'rh',
    format TEXT NOT NULL DEFAULT 'visio',
    place TEXT NOT NULL DEFAULT '',
    interviewers TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'prevu',
    outcome TEXT NOT NULL DEFAULT 'en_attente',
    preparation TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    next_steps TEXT NOT NULL DEFAULT '',
    ${stamps}
  );
  CREATE TABLE interactions (
    id INTEGER PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'note',
    direction TEXT NOT NULL DEFAULT 'sortant',
    date TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    ${stamps}
  );
  -- Événements de networking (Shift Project, forum de l'X, petit déjeuner AX…).
  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    organizer_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'afterwork',
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    place TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'repere',
    preparation TEXT NOT NULL DEFAULT '',
    debrief TEXT NOT NULL DEFAULT '',
    next_steps TEXT NOT NULL DEFAULT '',
    -- Contacts rencontrés : [{ contact_id, note }]
    attendees TEXT NOT NULL DEFAULT '[]',
    ${stamps}
  );
  CREATE TABLE templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'autre',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    ${stamps}
  );
  CREATE TABLE criteria (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    weight REAL NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    ${stamps}
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ''
  );
  -- Suppressions mémorisées pour les propager aux autres appareils.
  CREATE TABLE tombstones (
    tbl TEXT NOT NULL,
    id INTEGER NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (tbl, id)
  );
`;

/** Les données de départ sont datées de 1970 : toute modification réelle l'emporte à la synchro. */
const SEED_DATE = '1970-01-01T00:00:00';

export function seedRows(): Snapshot['tables'] {
  return {
    criteria: DEFAULT_CRITERIA.map((c, i) => ({ id: i + 1, ...c, position: i, created_at: SEED_DATE, updated_at: SEED_DATE })),
    templates: DEFAULT_TEMPLATES.map((t, i) => ({ id: i + 1, ...t, created_at: SEED_DATE, updated_at: SEED_DATE })),
  };
}

export interface Snapshot {
  tables: Partial<Record<TableName, Row[]>>;
  tombstones: { tbl: string; id: number; deleted_at: string }[];
}

export async function initDb(snapshot: Snapshot | null) {
  const sqlite3 = await sqlite3InitModule();
  db = new sqlite3.oo1.DB(':memory:', 'c') as unknown as typeof db;
  db.exec(SCHEMA);
  importSnapshot(snapshot ?? { tables: seedRows(), tombstones: [] });
}

// --- accès aux données -------------------------------------------------------------
export function sqlValue(v: unknown): SqlValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  if (v instanceof Uint8Array) return v;
  return JSON.stringify(v);
}

const bind = (params: unknown[]) => (params.length ? params.map(sqlValue) : undefined);

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db.selectObjects(sql, bind(params)) as T[];
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return all<T>(sql, ...params)[0];
}

export function run(sql: string, ...params: unknown[]) {
  db.exec({ sql, bind: bind(params) });
  return { changes: db.changes(), lastInsertRowid: Number(db.selectValue('SELECT last_insert_rowid()')) };
}

export function exec(sql: string) {
  db.exec(sql);
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function now() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function today() {
  return now().slice(0, 10);
}

/**
 * Identifiant unique sans serveur central : horodatage (ms) × 1000 + aléa.
 * Deux appareils hors ligne ne créent donc pas le même id. Reste sous 2^53.
 */
export function newId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// --- instantané (persistance + synchro) ------------------------------------------------
export function exportSnapshot(): Snapshot {
  const tables: Snapshot['tables'] = {};
  for (const t of TABLES) tables[t] = all(`SELECT * FROM ${t} ORDER BY ${t === 'settings' ? 'key' : 'id'}`);
  return { tables, tombstones: all('SELECT tbl, id, deleted_at FROM tombstones ORDER BY tbl, id') };
}

/** Remplace tout le contenu de la base par l'instantané, puis répare les références orphelines. */
export function importSnapshot(s: Snapshot) {
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    transaction(() => {
      for (const t of [...TABLES, 'tombstones']) db.exec(`DELETE FROM ${t}`);
      for (const t of TABLES) {
        // Colonnes inconnues ignorées : un instantané plus récent (autre appareil) reste importable.
        const known = new Set(all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name));
        for (const row of s.tables[t] ?? []) {
          const cols = Object.keys(row).filter((k) => known.has(k));
          if (!cols.length) continue;
          run(`INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((k) => row[k]));
        }
      }
      for (const tb of s.tombstones ?? []) run('INSERT OR REPLACE INTO tombstones (tbl, id, deleted_at) VALUES (?, ?, ?)', tb.tbl, tb.id, tb.deleted_at);
      // Références vers des éléments supprimés ailleurs.
      db.exec(`
        DELETE FROM projects WHERE company_id NOT IN (SELECT id FROM companies);
        UPDATE contacts SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
        UPDATE jobs SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
        UPDATE jobs SET contact_id = NULL WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts);
        UPDATE interviews SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
        UPDATE interviews SET job_id = NULL WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT id FROM jobs);
        UPDATE interviews SET contact_id = NULL WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts);
        UPDATE interactions SET company_id = NULL WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
        UPDATE interactions SET contact_id = NULL WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts);
        UPDATE interactions SET job_id = NULL WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT id FROM jobs);
        UPDATE events SET organizer_id = NULL WHERE organizer_id IS NOT NULL AND organizer_id NOT IN (SELECT id FROM companies);
      `);
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  // Base vide (premier lancement ou restauration partielle) : critères et modèles par défaut.
  if (!get('SELECT 1 AS x FROM criteria LIMIT 1') && !get(`SELECT 1 AS x FROM tombstones WHERE tbl = 'criteria' LIMIT 1`)) {
    for (const c of seedRows().criteria ?? []) {
      const cols = Object.keys(c);
      run(`INSERT INTO criteria (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((k) => c[k]));
    }
  }
  if (!get('SELECT 1 AS x FROM templates LIMIT 1') && !get(`SELECT 1 AS x FROM tombstones WHERE tbl = 'templates' LIMIT 1`)) {
    for (const t of seedRows().templates ?? []) {
      const cols = Object.keys(t);
      run(`INSERT INTO templates (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((k) => t[k]));
    }
  }
}

/** Mémorise une suppression (propagée aux autres appareils à la prochaine synchro). */
export function recordTombstone(tbl: string, id: number) {
  run('INSERT OR REPLACE INTO tombstones (tbl, id, deleted_at) VALUES (?, ?, ?)', tbl, id, now());
}
