// Déclenche la mise à jour du calendrier iCloud (workflow calendrier.yml du dépôt privé).
//
// Le workflow ne tourne pas à chaque push : l'app le lance une minute après la dernière synchro,
// et seulement si un élément du calendrier a changé (empreinte mémorisée sur l'appareil). Un dépôt
// sans ce workflow (404) ou un jeton sans droit Actions (403) : rien ne se passe.

import { getConfig, gh, GithubError } from '../lib/github';
import { exportSnapshot } from './db';

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

async function dispatchIfChanged() {
  const cfg = getConfig();
  if (!cfg) return;
  const fp = `${cfg.owner}/${cfg.repo}:${await fingerprint()}`;
  let last: string | null = null;
  try {
    last = localStorage.getItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  if (fp === last) return;
  try {
    await gh(`/{repo}/actions/workflows/calendrier.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: cfg.branch }) });
  } catch (e) {
    if (e instanceof GithubError && [403, 404, 422].includes(e.status)) return; // workflow absent ou jeton sans droit Actions
    throw e;
  }
  try {
    localStorage.setItem(KEY, fp);
  } catch {
    /* stockage indisponible */
  }
}

/** À appeler après chaque synchro réussie : les synchros rapprochées ne donnent qu'un seul passage. */
export function scheduleCalendarUpdate() {
  clearTimeout(timer);
  timer = setTimeout(() => void dispatchIfChanged().catch(() => {}), DELAY_MS);
}
