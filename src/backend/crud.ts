import { Hono } from 'hono';
import type { z } from 'zod';
import { all, get, newId, now, recordTombstone, run } from './db';

type Row = Record<string, any>;

export interface CrudConfig {
  table: string;
  /** Champs modifiables (sans valeurs par défaut : la base s'en charge). */
  schema: z.ZodObject<any>;
  /** Colonnes stockées en JSON. */
  json?: string[];
  /** Requête de base (avec jointures) ; l'alias de la table principale est `alias`. */
  select?: string;
  alias?: string;
  order?: string;
  /** Paramètres de requête autorisés → colonne qualifiée. */
  filters?: Record<string, string>;
  /** Ajuste les données avant écriture (création si `existing` absent). */
  prepare?: (data: Row, existing?: Row) => Row;
  /** Ajoute des champs calculés aux lignes lues. */
  decorate?: (rows: Row[]) => Row[];
}

export function decode(row: Row, json: string[] = []): Row {
  const out: Row = { ...row };
  for (const k of json) {
    if (typeof out[k] === 'string') {
      try {
        out[k] = JSON.parse(out[k]);
      } catch {
        /* valeur laissée telle quelle */
      }
    }
  }
  return out;
}

export function crud(cfg: CrudConfig) {
  const alias = cfg.alias ?? cfg.table;
  const base = cfg.select ?? `SELECT ${alias}.* FROM ${cfg.table} ${alias}`;
  const order = cfg.order ?? `${alias}.id DESC`;

  const list = (where = '', params: unknown[] = []): Row[] => {
    const rows = all<Row>(`${base} ${where} ORDER BY ${order}`, ...params).map((r) => decode(r, cfg.json));
    return cfg.decorate ? cfg.decorate(rows) : rows;
  };
  const one = (id: number): Row | undefined => list(`WHERE ${alias}.id = ?`, [id])[0];

  const clean = (data: Row) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

  const router = new Hono();

  router.get('/', (c) => {
    const conds: string[] = [];
    const params: unknown[] = [];
    for (const [param, col] of Object.entries(cfg.filters ?? {})) {
      const v = c.req.query(param);
      if (v === undefined || v === '') continue;
      if (v === 'null') conds.push(`${col} IS NULL`);
      else {
        conds.push(`${col} = ?`);
        params.push(v);
      }
    }
    return c.json(list(conds.length ? `WHERE ${conds.join(' AND ')}` : '', params));
  });

  router.get('/:id', (c) => {
    const row = one(Number(c.req.param('id')));
    return row ? c.json(row) : c.json({ error: 'Élément introuvable' }, 404);
  });

  router.post('/', async (c) => {
    let data = cfg.schema.parse(await c.req.json()) as Row;
    if (cfg.prepare) data = cfg.prepare(data);
    const stamp = now();
    data = clean({ ...data, id: newId(), created_at: stamp, updated_at: stamp });
    const keys = Object.keys(data);
    run(`INSERT INTO ${cfg.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, ...keys.map((k) => data[k]));
    return c.json(one(data.id), 201);
  });

  router.patch('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const existing = get<Row>(`SELECT * FROM ${cfg.table} WHERE id = ?`, id);
    if (!existing) return c.json({ error: 'Élément introuvable' }, 404);
    let data = cfg.schema.partial().parse(await c.req.json()) as Row;
    if (cfg.prepare) data = cfg.prepare(data, decode(existing, cfg.json));
    data = clean(data);
    const keys = Object.keys(data);
    if (keys.length) {
      run(
        `UPDATE ${cfg.table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        ...keys.map((k) => data[k]),
        now(),
        id,
      );
    }
    return c.json(one(id));
  });

  router.delete('/:id', (c) => {
    const id = Number(c.req.param('id'));
    run(`DELETE FROM ${cfg.table} WHERE id = ?`, id);
    recordTombstone(cfg.table, id);
    return c.json({ ok: true });
  });

  return { router, list, one };
}
