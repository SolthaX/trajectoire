// Déclenche la mise à jour du calendrier iCloud (workflow calendrier.yml du dépôt privé).
//
// Le workflow ne tourne pas à chaque push : l'app le lance une minute après la dernière synchro,
// et seulement si un élément du calendrier a changé (empreinte mémorisée sur l'appareil). Un dépôt
// sans ce workflow (404) ou un jeton sans droit Actions (403) : rien ne se passe.

import workflowYaml from '../../repo-template/.github/workflows/calendrier.yml?raw';
import scriptPy from '../../repo-template/.github/calendrier/icloud.py?raw';
import { writeRepoFiles } from '../lib/files';
import { getConfig, gh, GithubError, type WorkflowRun } from '../lib/github';
import { exportSnapshot } from './db';
import { readSettings } from './routes/misc';

export const CALENDAR_WORKFLOW = '.github/workflows/calendrier.yml';

const KEY = 'trajectoire:calendrier-empreinte';
const DELAY_MS = 60_000;
let timer: ReturnType<typeof setTimeout> | undefined;

type Row = Record<string, unknown>;
const pick = (rows: Row[] | undefined, cols: string[], keep: (r: Row) => boolean = () => true) =>
  (rows ?? []).filter(keep).map((r) => cols.map((c) => r[c] ?? null));

/** Ce que le script icloud.py lit : si rien de tout ça ne change, le calendrier non plus. */
function calendarPayload() {
  const t = exportSnapshot().tables;
  return JSON.stringify([
    pick(t.events, ['id', 'organizer_id', 'name', 'kind', 'starts_at', 'ends_at', 'place', 'link', 'url', 'status', 'preparation']),
    pick(t.interviews, ['id', 'company_id', 'job_id', 'scheduled_at', 'duration', 'kind', 'format', 'place', 'interviewers', 'status', 'preparation']),
    pick(t.contacts, ['id', 'first_name', 'last_name', 'company_id', 'role', 'status', 'next_followup'], (r) => !!r.next_followup),
    pick(t.interactions, ['id', 'contact_id', 'company_id', 'type', 'date', 'subject', 'content', 'link'], (r) => r.direction === 'prevu'),
    pick(t.companies, ['id', 'name']),
    pick(t.jobs, ['id', 'title', 'company_id']),
  ]);
}

async function fingerprint() {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(calendarPayload()));
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

function remember(fp: string) {
  try {
    localStorage.setItem(KEY, fp);
  } catch {
    /* stockage indisponible */
  }
}

async function dispatch() {
  const cfg = getConfig();
  if (!cfg) throw new GithubError('Dépôt GitHub non configuré.', 0);
  await gh(`/{repo}/actions/workflows/calendrier.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: cfg.branch }) });
  remember(`${cfg.owner}/${cfg.repo}:${await fingerprint()}`);
}

async function dispatchIfChanged() {
  const cfg = getConfig();
  if (!cfg || !readSettings().calendar_sync) return;
  const fp = `${cfg.owner}/${cfg.repo}:${await fingerprint()}`;
  let last: string | null = null;
  try {
    last = localStorage.getItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  if (fp === last) return;
  try {
    await dispatch();
  } catch (e) {
    if (e instanceof GithubError && [403, 404, 422].includes(e.status)) return; // workflow absent ou jeton sans droit Actions
    throw e;
  }
}

/** Lance la mise à jour tout de suite (bouton de Paramètres). */
export async function runCalendarNow() {
  try {
    await dispatch();
  } catch (e) {
    if (e instanceof GithubError && e.status === 404) throw new GithubError('Le workflow calendrier.yml est absent du dépôt : installez-le.', 404);
    if (e instanceof GithubError && e.status === 403) {
      throw new GithubError('Le jeton doit avoir le droit « Actions : Read and write » sur le dépôt.', 403);
    }
    throw e;
  }
}

/** Dernière exécution du workflow ; `null` : jamais lancé ; `'absent'` : workflow pas installé. */
export async function lastCalendarRun(): Promise<WorkflowRun | null | 'absent'> {
  try {
    const r = await gh<{ workflow_runs: WorkflowRun[] }>(`/{repo}/actions/workflows/calendrier.yml/runs?per_page=1`);
    return r.workflow_runs[0] ?? null;
  } catch (e) {
    if (e instanceof GithubError && e.status === 404) return 'absent';
    throw e;
  }
}

/** Ajoute le workflow et son script au dépôt (jeton avec le droit « Workflows : Read and write »). */
export async function installCalendarWorkflow() {
  try {
    await writeRepoFiles(
      [
        { path: CALENDAR_WORKFLOW, content: workflowYaml },
        { path: '.github/calendrier/icloud.py', content: scriptPy },
      ],
      'Ajout de la synchro du calendrier iCloud',
    );
  } catch (e) {
    if (e instanceof GithubError && [403, 404, 422].includes(e.status)) {
      throw new GithubError(
        "GitHub a refusé l'ajout du workflow : le jeton doit avoir le droit « Workflows : Read and write ». " +
          'Vous pouvez aussi copier repo-template/.github/ dans le dépôt.',
        e.status,
      );
    }
    throw e;
  }
}

/** À appeler après chaque synchro réussie : les synchros rapprochées ne donnent qu'un seul passage. */
export function scheduleCalendarUpdate() {
  clearTimeout(timer);
  timer = setTimeout(() => void dispatchIfChanged().catch(() => {}), DELAY_MS);
}
