// Transfert de la connexion GitHub vers un autre appareil (téléphone) par QR code ou code copié.
// Le code contient le jeton : il s'affiche à la demande, se masque tout seul, et n'est jamais envoyé.

import { checkRepo, setConfig, type RepoConfig } from './github';

const PREFIX = 'trajectoire-connexion:';

const b64url = {
  encode: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

export function encodeConnexion(cfg: RepoConfig) {
  return PREFIX + b64url.encode(JSON.stringify({ o: cfg.owner, r: cfg.repo, b: cfg.branch, t: cfg.token }));
}

export function decodeConnexion(raw: string): RepoConfig | null {
  const s = raw.trim();
  if (!s.startsWith(PREFIX)) return null;
  try {
    const v = JSON.parse(b64url.decode(s.slice(PREFIX.length))) as { o?: string; r?: string; b?: string; t?: string };
    if (!v.o || !v.r || !v.t) return null;
    return { owner: v.o, repo: v.r, branch: v.b || 'main', token: v.t };
  } catch {
    return null;
  }
}

/** Vérifie l'accès (dépôt privé obligatoire) puis enregistre la connexion sur cet appareil. */
export async function applyConnexion(cfg: RepoConfig) {
  const info = await checkRepo(cfg);
  if (!info.private) throw new Error('Ce dépôt est public : connexion refusée.');
  setConfig({ ...cfg, branch: info.default_branch || cfg.branch });
  return info.full_name;
}
