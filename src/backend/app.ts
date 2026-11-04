// « Serveur » embarqué : la même API REST qu'avant (Hono), exécutée dans le navigateur
// sur une base SQLite WebAssembly. L'interface l'appelle via backendFetch().

import { Hono } from 'hono';
import { ZodError } from 'zod';
import { exportSnapshot, initDb, type Snapshot } from './db';
import { companies, contacts, criteria, events, interactions, interviews, jobs, projects, templates } from './routes/entities';
import { backupRoutes, calendarRoutes, dashboardRoutes, searchRoutes, settingsRoutes } from './routes/misc';
import { loadState, requestPersistence, saveState } from './store';
import { configureSync, noteLocalChange, syncNow } from './sync';

const app = new Hono().basePath('/api');

// Toute écriture réussie : sauvegarde locale + synchro GitHub différée.
app.use('*', async (c, next) => {
  await next();
  if (c.req.method !== 'GET' && c.res.status < 400) {
    schedulePersist();
    noteLocalChange();
  }
});

app.route('/companies', companies.router);
app.route('/projects', projects.router);
app.route('/contacts', contacts.router);
app.route('/jobs', jobs.router);
app.route('/interviews', interviews.router);
app.route('/interactions', interactions.router);
app.route('/events', events.router);
app.route('/templates', templates.router);
app.route('/criteria', criteria.router);
app.route('/settings', settingsRoutes);
app.route('/dashboard', dashboardRoutes);
app.route('/calendar', calendarRoutes);
app.route('/search', searchRoutes);
app.route('/backup', backupRoutes);
app.all('*', (c) => c.json({ error: 'Route inconnue' }, 404));

app.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ error: err.issues.map((i) => i.message).join(' · ') }, 400);
  console.error(err);
  return c.json({ error: err.message || 'Erreur interne' }, 500);
});

// --- persistance locale ------------------------------------------------------------------
let persistTimer: ReturnType<typeof setTimeout> | undefined;

async function persistNow() {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  await saveState('db', exportSnapshot());
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void persistNow(), 300);
}

// Ne rien perdre si la fenêtre se ferme juste après une modification.
if (typeof window !== 'undefined') {
  const flush = () => persistTimer !== undefined && void persistNow();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

// --- démarrage ----------------------------------------------------------------------------
let ready: Promise<void> | null = null;

export function initBackend(onDataChanged: () => void = () => {}) {
  ready ||= (async () => {
    const snapshot = (await loadState<Snapshot>('db')) ?? null;
    await initDb(snapshot);
    if (!snapshot) await persistNow();
    requestPersistence();
    configureSync({ persist: persistNow, onDataChanged });
    void syncNow();
  })();
  return ready;
}

export async function backendFetch(req: Request): Promise<Response> {
  await initBackend();
  return app.fetch(req);
}
