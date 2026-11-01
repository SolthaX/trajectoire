import type { Contact, Job, Profile, Project } from '../../shared/types';
import { fmtLongDate } from './format';

export interface TemplateContext {
  contact?: Contact | null;
  companyName?: string | null;
  job?: Job | null;
  project?: Project | null;
  profile?: Profile | null;
}

export function buildVariables(ctx: TemplateContext): Record<string, string> {
  const { contact, job, project, profile } = ctx;
  const civ = contact?.civility === 'Mme' ? 'Madame' : contact?.civility === 'M.' ? 'Monsieur' : '';
  return {
    civilite: civ,
    prenom: contact?.first_name ?? '',
    nom: contact?.last_name ?? '',
    poste_contact: contact?.role ?? '',
    entreprise: ctx.companyName ?? contact?.company_name ?? job?.company_name ?? '',
    projet: project?.name ?? '',
    poste: job?.title ?? '',
    lien_offre: job?.url ?? '',
    mon_prenom: profile?.first_name ?? '',
    mon_nom: profile?.last_name ?? '',
    mon_email: profile?.email ?? '',
    mon_telephone: profile?.phone ?? '',
    mon_linkedin: profile?.linkedin ?? '',
    signature:
      profile?.signature ||
      [`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(), profile?.phone, profile?.email]
        .filter(Boolean)
        .join('\n'),
    date: fmtLongDate(),
  };
}

const VAR_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * Remplace les {{variables}}. Les variables vides restent visibles telles quelles
 * pour qu'on les repère, et sont listées dans `missing`.
 */
export function fillTemplate(text: string, vars: Record<string, string>) {
  const missing = new Set<string>();
  const out = text.replace(VAR_RE, (match, key: string) => {
    const v = vars[key.toLowerCase()];
    if (v) return v;
    missing.add(key.toLowerCase());
    return match;
  });
  return { text: out, missing: [...missing] };
}

/** Variante pour du HTML (lettres) : échappe les valeurs insérées. */
export function fillTemplateHtml(html: string, vars: Record<string, string>) {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const escaped = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v ? esc(v) : '']));
  return fillTemplate(html, escaped);
}

export function usedVariables(text: string) {
  return [...new Set([...text.matchAll(VAR_RE)].map((m) => m[1].toLowerCase()))];
}
