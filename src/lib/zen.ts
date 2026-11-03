// Liens externes ouverts dans Zen plutôt que dans Chrome.
//
// Une web app installée depuis Chrome ouvre ses liens dans Chrome, et une page ne peut pas choisir le
// navigateur. On passe donc par un protocole Windows, `zen-open:`, enregistré par
// `scripts/windows/installer-liens-zen.ps1` : le lien devient `zen-open:<URL encodée>`, Chrome demande une
// fois « Ouvrir Zen ? », et le lanceur ouvre l'adresse dans Zen. Réglage propre à l'appareil (localStorage),
// appliqué uniquement dans l'app installée : un onglet ordinaire et l'iPhone gardent des liens normaux.

import { useSyncExternalStore } from 'react';
import { isStandalone } from './pwa';

const KEY = 'trajectoire:liens-zen';
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let enabled = typeof window !== 'undefined' && read();

export function setZenLinks(on: boolean) {
  enabled = on;
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

export function useZenLinks() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );
}

/** Adresse `zen-open:` pour une URL externe en http(s), ou `null` si elle doit rester dans l'app. */
function zenHref(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw, location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null; // mailto:, tel:, blob: (PDF locaux)…
  if (url.origin === location.origin && url.pathname.startsWith(import.meta.env.BASE_URL)) return null; // l'app elle-même
  return `zen-open:${encodeURIComponent(url.href)}`;
}

/** Ouvre une URL dans Zen. */
export function openInZen(raw: string) {
  const href = zenHref(raw);
  if (href) location.href = href; // protocole externe : Chrome le confie à Windows, la page reste en place
}

const active = () => enabled && isStandalone();

/** Intercepte les clics sur les liens externes et `window.open` (appelé une fois au démarrage). */
export function installZenLinks() {
  const onClick = (e: MouseEvent) => {
    if (!active() || e.defaultPrevented) return;
    if (e.type === 'click' && e.button !== 0) return;
    if (e.type === 'auxclick' && e.button !== 1) return;
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.hasAttribute('download')) return;
    const href = zenHref(a.href);
    if (!href) return;
    e.preventDefault();
    location.href = href;
  };
  document.addEventListener('click', onClick);
  document.addEventListener('auxclick', onClick);

  const nativeOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = active() && url ? zenHref(String(url)) : null;
    if (!href) return nativeOpen(url, target, features);
    location.href = href;
    return null;
  };
}
