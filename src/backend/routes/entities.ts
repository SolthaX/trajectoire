import { z } from 'zod';
import { projectScore } from '../../../shared/score';
import { crud } from '../crud';
import { all, get, today } from '../db';

// --- briques de schéma -------------------------------------------------------
const text = z.string().optional();
const required = (label: string) => z.string().trim().min(1, `${label} est obligatoire`);
const date = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : v === undefined ? undefined : null));
const id = z.number().int().nullable().optional();

type Criteria = { id: number; weight: number }[];
const loadCriteria = () => all<{ id: number; weight: number }>('SELECT id, weight FROM criteria');
const parseScores = (raw: unknown) => {
  if (typeof raw !== 'string') return (raw ?? {}) as Record<string, number | null>;
  try {
    return JSON.parse(raw) as Record<string, number | null>;
  } catch {
    return {};
  }
};

// --- entreprises -------------------------------------------------------------
export const companies = crud({
  table: 'companies',
  alias: 'co',
  select: `SELECT co.*,
      (SELECT COUNT(*) FROM contacts WHERE company_id = co.id) AS contacts_count,
      (SELECT COUNT(*) FROM jobs WHERE company_id = co.id) AS jobs_count,
      (SELECT COUNT(*) FROM projects WHERE company_id = co.id) AS projects_count,
      (SELECT MAX(date) FROM interactions WHERE company_id = co.id) AS last_activity
    FROM companies co`,
  order: 'co.name COLLATE NOCASE',
  json: ['locations'],
  filters: { status: 'co.status', priority: 'co.priority' },
  schema: z.object({
    name: required('Le nom'),
    sector: text,
    website: text,
    linkedin: text,
    size: text,
    description: text,
    notes: text,
    status: text,
    priority: text,
    locations: z
      .array(z.object({ label: z.string(), city: z.string(), address: z.string() }))
      .optional(),
  }),
  decorate: (rows) => {
    if (!rows.length) return rows;
    const criteria: Criteria = loadCriteria();
    const best = new Map<number, number>();
    for (const p of all<{ company_id: number; scores: string }>('SELECT company_id, scores FROM projects')) {
      const s = projectScore(parseScores(p.scores), criteria);
      if (s != null && s > (best.get(p.company_id) ?? -1)) best.set(p.company_id, s);
    }
    return rows.map((r) => ({ ...r, best_score: best.get(r.id) ?? null }));
  },
});

// --- projets -----------------------------------------------------------------
export const projects = crud({
  table: 'projects',
  alias: 'p',
  select: `SELECT p.*, co.name AS company_name FROM projects p JOIN companies co ON co.id = p.company_id`,
  order: `CASE p.status WHEN 'en_cours' THEN 0 WHEN 'a_venir' THEN 1 ELSE 2 END, p.updated_at DESC`,
  json: ['links', 'scores'],
  filters: { company_id: 'p.company_id', status: 'p.status' },
  schema: z.object({
    company_id: z.number().int(),
    name: required('Le nom du projet'),
    status: text,
    summary: text,
    details: text,
    links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
    start_date: date,
    end_date: date,
    scores: z.record(z.string(), z.number().min(0).max(5).nullable()).optional(),
    notes: text,
  }),
  decorate: (rows) => {
    const criteria = loadCriteria();
    return rows.map((r) => ({ ...r, score: projectScore(r.scores ?? {}, criteria) }));
  },
});

// --- contacts ----------------------------------------------------------------
export const contacts = crud({
  table: 'contacts',
  alias: 'c',
  select: `SELECT c.*, co.name AS company_name,
      (SELECT MAX(date) FROM interactions WHERE contact_id = c.id) AS last_interaction
    FROM contacts c LEFT JOIN companies co ON co.id = c.company_id`,
  order: `CASE c.priority WHEN 'haute' THEN 0 WHEN 'moyenne' THEN 1 ELSE 2 END, c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE`,
  filters: { company_id: 'c.company_id', status: 'c.status', priority: 'c.priority' },
  schema: z.object({
    company_id: id,
    civility: text,
    first_name: text,
    last_name: text,
    role: text,
    email: text,
    phone: text,
    linkedin: text,
    status: text,
    priority: text,
    next_followup: date,
    source: text,
    notes: text,
  }),
});

// --- offres ------------------------------------------------------------------
export const jobs = crud({
  table: 'jobs',
  alias: 'j',
  select: `SELECT j.*, co.name AS company_name,
      TRIM(COALESCE(ct.first_name, '') || ' ' || COALESCE(ct.last_name, '')) AS contact_name
    FROM jobs j
    LEFT JOIN companies co ON co.id = j.company_id
    LEFT JOIN contacts ct ON ct.id = j.contact_id`,
  order: 'j.created_at DESC, j.id DESC',
  json: ['documents'],
  filters: { company_id: 'j.company_id', contact_id: 'j.contact_id', status: 'j.status', priority: 'j.priority' },
  schema: z.object({
    company_id: id,
    contact_id: id,
    title: required("L'intitulé"),
    url: text,
    location: text,
    contract: text,
    remote: text,
    salary: text,
    status: text,
    priority: text,
    deadline: date,
    applied_at: date,
    description: text,
    notes: text,
    documents: z.array(z.string()).optional(),
  }),
  prepare: (data, existing) => {
    // Date de candidature renseignée automatiquement au passage à « Postulé ».
    const status = data.status ?? existing?.status;
    const applied = data.applied_at !== undefined ? data.applied_at : existing?.applied_at;
    if (['postule', 'entretien', 'offre', 'refuse'].includes(status) && !applied) {
      data.applied_at = today();
    }
    return data;
  },
});

// --- entretiens --------------------------------------------------------------
export const interviews = crud({
  table: 'interviews',
  alias: 'iv',
  select: `SELECT iv.*, co.name AS company_name, j.title AS job_title,
      TRIM(COALESCE(ct.first_name, '') || ' ' || COALESCE(ct.last_name, '')) AS contact_name
    FROM interviews iv
    LEFT JOIN companies co ON co.id = iv.company_id
    LEFT JOIN jobs j ON j.id = iv.job_id
    LEFT JOIN contacts ct ON ct.id = iv.contact_id`,
  order: 'iv.scheduled_at DESC',
  filters: { company_id: 'iv.company_id', job_id: 'iv.job_id', contact_id: 'iv.contact_id', status: 'iv.status' },
  schema: z.object({
    company_id: id,
    job_id: id,
    contact_id: id,
    scheduled_at: required('La date'),
    duration: z.number().int().nullable().optional(),
    kind: text,
    format: text,
    place: text,
    interviewers: text,
    status: text,
    outcome: text,
    preparation: text,
    notes: text,
    next_steps: text,
  }),
  prepare: (data, existing) => {
    const jobId = data.job_id ?? existing?.job_id;
    if (jobId && !(data.company_id ?? existing?.company_id)) {
      data.company_id = get<{ company_id: number | null }>('SELECT company_id FROM jobs WHERE id = ?', jobId)?.company_id ?? null;
    }
    return data;
  },
});

// --- journal des échanges ------------------------------------------------------
export const interactions = crud({
  table: 'interactions',
  alias: 'i',
  select: `SELECT i.*, co.name AS company_name, j.title AS job_title,
      TRIM(COALESCE(ct.first_name, '') || ' ' || COALESCE(ct.last_name, '')) AS contact_name
    FROM interactions i
    LEFT JOIN companies co ON co.id = i.company_id
    LEFT JOIN jobs j ON j.id = i.job_id
    LEFT JOIN contacts ct ON ct.id = i.contact_id`,
  order: 'i.date DESC, i.id DESC',
  filters: { company_id: 'i.company_id', contact_id: 'i.contact_id', job_id: 'i.job_id', type: 'i.type' },
  schema: z.object({
    contact_id: id,
    company_id: id,
    job_id: id,
    type: text,
    direction: text,
    date: required('La date'),
    subject: text,
    content: text,
  }),
  prepare: (data, existing) => {
    if (!(data.company_id ?? existing?.company_id)) {
      const contactId = data.contact_id ?? existing?.contact_id;
      const jobId = data.job_id ?? existing?.job_id;
      const fromContact = contactId
        ? get<{ company_id: number | null }>('SELECT company_id FROM contacts WHERE id = ?', contactId)?.company_id
        : null;
      const fromJob = jobId ? get<{ company_id: number | null }>('SELECT company_id FROM jobs WHERE id = ?', jobId)?.company_id : null;
      if (fromContact || fromJob) data.company_id = fromContact ?? fromJob;
    }
    return data;
  },
});

// --- modèles de mails ------------------------------------------------------------
export const templates = crud({
  table: 'templates',
  order: `CASE category WHEN 'premier_contact' THEN 0 WHEN 'candidature' THEN 1 WHEN 'relance' THEN 2 WHEN 'remerciement' THEN 3 ELSE 4 END, name COLLATE NOCASE`,
  filters: { category: 'templates.category' },
  schema: z.object({
    name: required('Le nom'),
    category: text,
    subject: text,
    body: text,
  }),
});

// --- critères de notation ---------------------------------------------------------
export const criteria = crud({
  table: 'criteria',
  order: 'criteria.position, criteria.id',
  schema: z.object({
    name: required('Le nom'),
    description: text,
    weight: z.number().min(0).max(10).optional(),
    position: z.number().int().optional(),
  }),
});
