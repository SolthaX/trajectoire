// Web app installable : invite d'installation (Chrome / Edge) et service worker.

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches);

/** `canInstall` : le navigateur propose l'installation (Chrome / Edge, app pas encore installée). */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => !!deferred && !isStandalone(),
  );
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    return outcome === 'accepted';
  };
  return { canInstall, install };
}

/** Enregistre le service worker (version compilée uniquement). `onUpdate` : nouvelle version prête. */
export function registerServiceWorker(onUpdate: () => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdate();
  });
}
