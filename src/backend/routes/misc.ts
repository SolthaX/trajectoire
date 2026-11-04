import { Hono } from 'hono';
import { z } from 'zod';
import {
  APPLIED_STATUSES,
  CLOSED_CONTACT_STATUSES,
  CONTACTED_STATUSES,
  RESPONDED_STATUSES,
} from '../../../shared/constants';
import type { Settings } from '../../../shared/types';
import { all, exportSnapshot, get, importSnapshot, now, run, today, type Snapshot } from '../db';
import { getFileIndex } from '../fileIndex';
import { companies, contacts, events as networkEvents, interactions, interviews, jobs, projects } from './entities';

// --- paramètres ----------------------------------------------------------------
const DEFAULT_SETTINGS: Settings = {
  profile: { first_name: '', last_name: '', email: '', phone: '', linkedin: '', signature: '' },
  followup_days: 7,
  latex_engine: 'github',
  calendar_sync: false,
};

export function readSettings(): Settings {
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      stored[r.key] = JSON.parse(r.value);
    } catch {
      /* ignoré */
    }
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    profile: { ...DEFAULT_SETTINGS.profile, ...((stored.profile as object) ?? {}) },
  } as Settings;
}

export const settingsRoutes = new Hono()
  .get('/', (c) => c.json(readSettings()))
  .put('/', async (c) => {
    const body = z
      .object({
        profile: z
          .object({
            first_name: z.string(),
            last_name: z.string(),
            email: z.string(),
            phone: z.string(),
            linkedin: z.string(),
            signature: z.string(),
          })
          .partial()
          .optional(),
        followup_days: z.number().int().min(1).max(90).optional(),
        latex_engine: z.enum(['github', 'rapide']).optional(),
        calendar_sync: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const current = readSettings();
    const next = { ...current, ...body, profile: { ...current.profile, ...(body.profile ?? {}) } };
    const stamp = now();
    for (const [k, v] of Object.entries(next)) {
      const value = JSON.stringify(v);
      const prev = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', k);
      if (prev?.value === value) continue;
      run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', k, value, stamp);
    }
    return c.json(readSettings());
  });

// --- tableau de bord -----------------------------------------------------------
function isoWeekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - day);
  return x;
}
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inList = (list: readonly string[]) => list.map((s) => `'${s}'`).join(', ');

export const dashboardRoutes = new Hono().get('/', (c) => {
  const t = today();
  const in7 = ymd(new Date(Date.now() + 7 * 86400000));
  const count = (sql: string, ...p: unknown[]) => (get<{ n: number }>(sql, ...p)?.n ?? 0);

  const kpis = {
    companies: count(`SELECT COUNT(*) n FROM companies WHERE status != 'ecartee'`),
    contacts_active: count(`SELECT COUNT(*) n FROM contacts WHERE status IN ('en_contact', 'rdv')`),
    contacted: count(`SELECT COUNT(*) n FROM contacts WHERE status IN (${inList(CONTACTED_STATUSES)})`),
    responded: count(`SELECT COUNT(*) n FROM contacts WHERE status IN (${inList(RESPONDED_STATUSES)})`),
    applications: count(`SELECT COUNT(*) n FROM jobs WHERE status IN (${inList(APPLIED_STATUSES)})`),
    interviews_upcoming: count(`SELECT COUNT(*) n FROM interviews WHERE status = 'prevu' AND scheduled_at >= ?`, t),
    offers: count(`SELECT COUNT(*) n FROM jobs WHERE status = 'offre'`),
  };

  const followups = contacts
    .list(`WHERE c.next_followup IS NOT NULL AND c.next_followup <= ? AND c.status NOT IN (${inList(CLOSED_CONTACT_STATUSES)})`, [in7])
    .map((r): Record<string, any> => ({
      ...r,
      overdue_days: Math.round((Date.parse(t) - Date.parse(r.next_followup)) / 86400000),
    }))
    .sort((a, b) => String(a.next_followup).localeCompare(String(b.next_followup)));

  const upcoming_interviews = interviews
    .list(`WHERE iv.status = 'prevu' AND iv.scheduled_at >= ?`, [t])
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
    .slice(0, 6);

  const deadlines = jobs
    .list(`WHERE j.deadline IS NOT NULL AND j.deadline >= ? AND j.deadline <= ? AND j.status IN ('a_etudier', 'a_postuler')`, [t, in7])
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  const to_apply = jobs.list(`WHERE j.status = 'a_postuler' AND j.priority = 'haute'`).slice(0, 6);
  const to_contact = contacts.list(`WHERE c.status = 'non_contacte' AND c.priority = 'haute'`).slice(0, 6);

  // Activité : échanges « sortants » + candidatures, par semaine, 12 semaines.
  const start = isoWeekStart(new Date());
  start.setDate(start.getDate() - 7 * 11);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * i);
    return ymd(d);
  });
  const weekly = weeks.map((w) => ({ week: w, count: 0 }));
  const events = all<{ d: string }>(
    `SELECT substr(date, 1, 10) d FROM interactions WHERE date >= ? AND direction != 'prevu'
     UNION ALL SELECT applied_at d FROM jobs WHERE applied_at IS NOT NULL AND applied_at >= ?
       AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.job_id = jobs.id AND i.type = 'candidature' AND i.direction != 'prevu')`,
    weeks[0],
    weeks[0],
  );
  for (const e of events) {
    const idx = weeks.findLastIndex((w) => e.d >= w);
    if (idx >= 0) weekly[idx].count++;
  }

  const jobCount = (statuses: readonly string[]) =>
    count(`SELECT COUNT(*) n FROM jobs WHERE status IN (${inList(statuses)})`);
  const funnel = [
    { key: 'reperees', label: 'Offres repérées', count: count('SELECT COUNT(*) n FROM jobs') },
    { key: 'postulees', label: 'Candidatures envoyées', count: jobCount(APPLIED_STATUSES) },
    {
      key: 'entretiens',
      label: "Avec entretien",
      count: count(
        `SELECT COUNT(*) n FROM jobs WHERE status IN ('entretien', 'offre') OR id IN (SELECT job_id FROM interviews WHERE job_id IS NOT NULL)`,
      ),
    },
    { key: 'offres', label: 'Offres reçues', count: jobCount(['offre']) },
  ];

  const contact_statuses = all<{ status: string; count: number }>(
    'SELECT status, COUNT(*) count FROM contacts GROUP BY status',
  );

  const top_companies = companies
    .list(`WHERE co.status != 'ecartee'`)
    .filter((co) => co.best_score != null)
    .sort((a, b) => b.best_score - a.best_score)
    .slice(0, 6)
    .map((co) => ({ id: co.id, name: co.name, score: co.best_score, projects: co.projects_count }));

  const upcoming_events = networkEvents
    .list(`WHERE e.status IN ('repere', 'inscrit') AND substr(e.starts_at, 1, 10) >= ?`, [t])
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
    .slice(0, 8);

  const recent = interactions.list(`WHERE i.direction != 'prevu'`).slice(0, 8);
  const planned = interactions.list(`WHERE i.direction = 'prevu'`).reverse();

  return c.json({
    kpis,
    followups,
    upcoming_interviews,
    upcoming_events,
    deadlines,
    to_apply,
    to_contact,
    weekly,
    funnel,
    contact_statuses,
    top_companies,
    recent,
    planned,
  });
});

// --- calendrier mensuel --------------------------------------------------------
// Tout ce qui a une date, entre `from` et `to` (AAAA-MM-JJ, inclus) : événements de networking,
// entretiens, relances, messages et calls prévus, échanges faits.
export const calendarRoutes = new Hono().get('/', (c) => {
  const from = c.req.query('from') ?? today();
  const to = c.req.query('to') ?? from;
  const range = [from, to];
  const day = (col: string) => `substr(${col}, 1, 10) BETWEEN ? AND ?`;
  const items: Record<string, unknown>[] = [];

  for (const e of networkEvents.list(`WHERE ${day('e.starts_at')} AND e.status != 'annule'`, range))
    items.push({ key: `e${e.id}`, kind: 'evenement', date: e.starts_at, title: e.name, sub: e.organizer_name ?? '', status: e.status, event_id: e.id });

  for (const iv of interviews.list(`WHERE ${day('iv.scheduled_at')} AND iv.status != 'annule'`, range))
    items.push({
      key: `i${iv.id}`,
      kind: 'entretien',
      date: iv.scheduled_at,
      title: iv.company_name ?? iv.job_title ?? 'Entretien',
      sub: iv.job_title && iv.company_name ? iv.job_title : '',
      detail: iv.kind,
      status: iv.status,
      job_id: iv.job_id,
    });

  for (const ct of contacts.list(`WHERE ${day('c.next_followup')} AND c.status NOT IN (${inList(CLOSED_CONTACT_STATUSES)})`, range))
    items.push({
      key: `f${ct.id}`,
      kind: 'relance',
      date: ct.next_followup,
      title: [ct.first_name, ct.last_name].filter(Boolean).join(' ') || 'Contact',
      sub: ct.company_name ?? '',
      contact_id: ct.id,
    });

  for (const it of interactions.list(`WHERE ${day('i.date')} AND i.type != 'note'`, range))
    items.push({
      key: `m${it.id}`,
      kind: it.direction === 'prevu' ? 'prevu' : 'echange',
      date: it.date,
      title: it.contact_name || it.company_name || it.subject || '—',
      sub: it.subject && (it.contact_name || it.company_name) ? it.subject : '',
      detail: it.type,
      status: it.direction,
      contact_id: it.contact_id,
      company_id: it.company_id,
    });

  items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return c.json(items);
});

// --- recherche globale ---------------------------------------------------------
const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const searchRoutes = new Hono().get('/', (c) => {
  const q = norm(c.req.query('q')).trim();
  if (!q) return c.json([]);
  const terms = q.split(/\s+/);
  const match = (...fields: unknown[]) => {
    const hay = norm(fields.join(' '));
    return terms.every((t) => hay.includes(t));
  };
  const out: { type: string; id: string; title: string; subtitle: string }[] = [];
  for (const co of all<any>('SELECT id, name, sector, locations FROM companies')) {
    if (match(co.name, co.sector, co.locations)) out.push({ type: 'company', id: String(co.id), title: co.name, subtitle: co.sector });
  }
  for (const ct of contacts.list()) {
    const others = (ct.affiliations ?? []).map((a: { company_name: string; role: string }) => `${a.company_name} ${a.role}`).join(' ');
    if (match(ct.first_name, ct.last_name, ct.email, ct.role, ct.company_name, others)) {
      out.push({
        type: 'contact',
        id: String(ct.id),
        title: `${ct.first_name} ${ct.last_name}`.trim() || ct.email || 'Sans nom',
        subtitle: [ct.role, ct.company_name].filter(Boolean).join(' · '),
      });
    }
  }
  for (const j of jobs.list()) {
    if (match(j.title, j.company_name, j.location)) {
      out.push({ type: 'job', id: String(j.id), title: j.title, subtitle: [j.company_name, j.location].filter(Boolean).join(' · ') });
    }
  }
  for (const ev of networkEvents.list()) {
    if (match(ev.name, ev.organizer_name, ev.place)) {
      out.push({ type: 'event', id: String(ev.id), title: ev.name, subtitle: [ev.organizer_name, ev.starts_at.slice(0, 10)].filter(Boolean).join(' · ') });
    }
  }
  for (const p of projects.list()) {
    if (match(p.name, p.summary)) {
      out.push({ type: 'company', id: String(p.company_id), title: p.name, subtitle: `Projet · ${p.company_name}` });
    }
  }
  for (const f of getFileIndex()) {
    if (match(f)) {
      const cut = f.lastIndexOf('/');
      out.push({ type: 'file', id: f, title: f.slice(cut + 1), subtitle: cut > 0 ? f.slice(0, cut) : 'Documents' });
    }
  }
  return c.json(out.slice(0, 40));
});

// --- sauvegarde / restauration --------------------------------------------------
export const backupRoutes = new Hono()
  .get('/', (c) => c.json({ app: 'trajectoire', version: 2, exported_at: now(), ...exportSnapshot() }))
  .post('/', async (c) => {
    const body = z
      .object({
        app: z.literal('trajectoire'),
        tables: z.record(z.string(), z.array(z.record(z.string(), z.any()))),
        tombstones: z.array(z.object({ tbl: z.string(), id: z.number(), deleted_at: z.string() })).optional(),
      })
      .parse(await c.req.json());
    // Les lignes restaurées deviennent « récentes » pour l'emporter à la prochaine synchro.
    const stamp = now();
    const tables = Object.fromEntries(
      Object.entries(body.tables).map(([t, rows]) => [t, rows.map((r) => ({ ...r, updated_at: stamp }))]),
    ) as Snapshot['tables'];
    const ids = new Set(Object.entries(tables).flatMap(([t, rows]) => (rows ?? []).map((r) => `${t}:${r.id ?? r.key}`)));
    // Ce qui existait mais n'est pas dans la sauvegarde est supprimé (et propagé).
    const current = exportSnapshot();
    const tombstones = [...current.tombstones];
    for (const [t, rows] of Object.entries(current.tables)) {
      for (const r of rows ?? []) if (t !== 'settings' && !ids.has(`${t}:${r.id}`)) tombstones.push({ tbl: t, id: r.id, deleted_at: stamp });
    }
    importSnapshot({ tables, tombstones });
    return c.json({ ok: true });
  });
