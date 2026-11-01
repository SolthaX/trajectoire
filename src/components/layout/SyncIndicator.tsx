import { clsx } from 'clsx';
import { AlertTriangle, Cloud, CloudOff, Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { scheduleSync, syncNow, useSyncStatus } from '../../backend/sync';
import { fmtAgo } from '../../lib/format';
import { useGithubConfig } from '../../lib/github';
import { useInstallPrompt } from '../../lib/pwa';

/** État de la synchro GitHub, en bas de la barre latérale. Clic = synchroniser maintenant. */
export function SyncIndicator() {
  const cfg = useGithubConfig();
  const status = useSyncStatus();
  const [, tick] = useState(0);

  // Rafraîchit « il y a 2 min » et resynchronise au retour sur la fenêtre.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    const periodic = setInterval(() => document.visibilityState === 'visible' && scheduleSync(0), 5 * 60_000);
    const onFocus = () => scheduleSync(300);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      clearInterval(periodic);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!cfg) {
    return (
      <Link to="/parametres#github" className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-3 hover:bg-surface-2 hover:text-ink-2">
        <CloudOff className="size-3.5" />
        <span className="truncate">Données sur cet appareil · synchroniser</span>
      </Link>
    );
  }

  const label =
    status.state === 'syncing'
      ? 'Synchronisation…'
      : status.state === 'offline'
        ? 'Hors ligne · enregistré localement'
        : status.state === 'error'
          ? 'Synchro en échec'
          : status.lastSync
            ? `Synchronisé ${fmtAgo(status.lastSync)}`
            : 'Synchronisé';

  return (
    <button
      onClick={() =>
        syncNow().then(() => {
          // Affiche l'erreur éventuelle (le statut est mis à jour par syncNow).
        })
      }
      title={status.error ?? `Dépôt ${cfg.owner}/${cfg.repo} · cliquer pour synchroniser`}
      className={clsx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-2',
        status.state === 'error' ? 'text-danger' : 'text-ink-3 hover:text-ink-2',
      )}
    >
      {status.state === 'syncing' ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : status.state === 'error' ? (
        <AlertTriangle className="size-3.5" />
      ) : status.state === 'offline' ? (
        <CloudOff className="size-3.5" />
      ) : (
        <Cloud className="size-3.5" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Bouton « Installer l'app » quand le navigateur le propose (Chrome / Edge). */
export function InstallButton() {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <button
      onClick={async () => {
        if (await install()) toast.success("Trajectoire est installée : clic droit sur son icône → « Épingler à la barre des tâches ».", { duration: 8000 });
      }}
      className="mb-2 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[12.5px] font-medium text-bg shadow-sm hover:bg-ink/85"
    >
      <Download className="size-3.5" /> Installer l'app
    </button>
  );
}
