import workflowYaml from '../../../repo-template/.github/workflows/latex.yml?raw';
import { GithubError, listRuns, type WorkflowRun } from '../../lib/github';
import { DOCS_ROOT, filesApi, LATEX_WORKFLOW_PATH, writeRepoFile } from '../../lib/files';
import { STARTER_CV_TEX, STARTER_LETTER_HTML } from './starter';

// Compilation LaTeX déportée sur GitHub Actions (workflow repo-template/.github/workflows/latex.yml).

export const WORKFLOW_NAME = 'Compilation LaTeX';
export const LATEX_WORKFLOW_YAML = workflowYaml;

const POLL_MS = 3000;
const MAX_WAIT_MS = 5 * 60_000;
/** Au-delà, si aucune exécution n'est apparue, on considère que le workflow ne s'est pas déclenché. */
const NO_RUN_MS = 75_000;

export type RunWait =
  | { outcome: 'completed'; run: WorkflowRun }
  | { outcome: 'timeout'; run: WorkflowRun | null }
  | { outcome: 'no-run' }
  | { outcome: 'cancelled' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Suit l'exécution GitHub Actions déclenchée par un commit (ou un lancement manuel après `since`).
 * `onProgress` reçoit l'exécution trouvée (null tant qu'elle n'est pas apparue).
 */
export async function waitForLatexRun(opts: {
  sha: string;
  since?: number;
  onProgress: (run: WorkflowRun | null) => void;
  isCancelled: () => boolean;
}): Promise<RunWait> {
  const start = Date.now();
  let last: WorkflowRun | null = null;
  while (Date.now() - start < MAX_WAIT_MS) {
    if (opts.isCancelled()) return { outcome: 'cancelled' };
    let runs: WorkflowRun[] = [];
    try {
      runs = await listRuns(opts.sha);
    } catch (e) {
      if (e instanceof GithubError && (e.status === 403 || e.status === 404)) {
        throw new GithubError(
          "Impossible de suivre GitHub Actions : le jeton doit avoir le droit « Actions : lecture » sur le dépôt.",
          e.status,
        );
      }
      // Erreur réseau passagère : on réessaie au tour suivant.
    }
    const run = runs
      .filter((r) => (r.name === WORKFLOW_NAME || /latex/i.test(r.name)) && (!opts.since || Date.parse(r.created_at) >= opts.since - 15_000))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    if (run) {
      last = run;
      opts.onProgress(run);
      if (run.status === 'completed') return { outcome: 'completed', run };
    } else {
      opts.onProgress(null);
      if (Date.now() - start > NO_RUN_MS) return { outcome: 'no-run' };
    }
    await sleep(POLL_MS);
  }
  return { outcome: 'timeout', run: last };
}

/** Lit l'en-tête du journal écrit par le workflow : « # Compilation réussie|échec — chemin — … ». */
export function parseLogHeader(log: string): { ok: boolean; path: string } | null {
  const m = /^# Compilation (réussie|échec) — ([^—]+?) —/.exec(log);
  return m ? { ok: m[1] === 'réussie', path: m[2].trim() } : null;
}

/** Ajoute le workflow de compilation au dépôt. */
export async function installLatexWorkflow() {
  try {
    await writeRepoFile(LATEX_WORKFLOW_PATH, LATEX_WORKFLOW_YAML, 'Ajout du workflow de compilation LaTeX');
  } catch (e) {
    if (e instanceof GithubError && [403, 404, 422].includes(e.status)) {
      throw new GithubError(
        "GitHub a refusé l'ajout du workflow : le jeton doit avoir le droit « Workflows : lecture et écriture ». " +
          'Vous pouvez aussi copier repo-template/.github/workflows/latex.yml dans le dépôt.',
        e.status,
      );
    }
    throw e;
  }
}

/**
 * Crée le contenu de démarrage dans documents/ (un seul commit), avec le workflow si possible.
 * Renvoie `workflow: false` si le jeton n'a pas le droit d'écrire les workflows.
 */
export async function initializeDocuments(withWorkflow: boolean): Promise<{ workflow: boolean }> {
  const files = [
    { path: 'CV/cv-exemple.tex', content: STARTER_CV_TEX },
    { path: 'Lettres/lettre-modele.html', content: STARTER_LETTER_HTML },
    { path: 'Divers/.gitkeep', content: '' },
  ];
  const message = `Initialisation du dossier ${DOCS_ROOT}/`;
  if (withWorkflow) {
    try {
      await filesApi.writeMany(
        files.filter((f) => !f.path.endsWith('.gitkeep')),
        message,
        [
          { path: `${DOCS_ROOT}/Divers/.gitkeep`, content: '' },
          { path: LATEX_WORKFLOW_PATH, content: LATEX_WORKFLOW_YAML },
        ],
      );
      return { workflow: true };
    } catch (e) {
      if (!(e instanceof GithubError) || ![403, 404, 422].includes(e.status)) throw e;
      // Jeton sans droit « Workflows » : on initialise sans le workflow.
    }
  }
  await filesApi.writeMany(files.filter((f) => !f.path.endsWith('.gitkeep')), message, [{ path: `${DOCS_ROOT}/Divers/.gitkeep`, content: '' }]);
  return { workflow: false };
}
