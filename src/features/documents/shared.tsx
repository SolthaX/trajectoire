import { clsx } from 'clsx';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { basename, dirname } from '../../lib/files';
import { FileIcon } from './fileTypes';

/** En-tête commun des visionneuses : nom du fichier, état, actions. */
export function ViewerHeader({ path, status, children }: { path: string; status?: ReactNode; children?: ReactNode }) {
  const dir = dirname(path);
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <FileIcon path={path} className="size-[18px] shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] leading-tight font-medium text-ink" title={path}>
          {basename(path)}
        </div>
        <div className="truncate text-[11.5px] leading-tight text-ink-3">{dir ? dir.split('/').join(' / ') : 'Documents'}</div>
      </div>
      {status && <div className="shrink-0">{status}</div>}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

export type SaveState = 'saved' | 'dirty' | 'saving';

export function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium',
        state === 'dirty' && 'bg-warning-soft text-warning-ink',
        state === 'saved' && 'text-ink-3',
        state === 'saving' && 'text-ink-3',
      )}
      aria-live="polite"
    >
      {state === 'dirty' && (
        <>
          <span className="size-1.5 rounded-full bg-[var(--c-amber)]" /> Modifié
        </>
      )}
      {state === 'saving' && (
        <>
          <Loader2 className="size-3 animate-spin" /> Enregistrement…
        </>
      )}
      {state === 'saved' && (
        <>
          <Check className="size-3" /> Enregistré
        </>
      )}
    </span>
  );
}

/** Ctrl+S (ou Cmd+S) tant que le composant est monté. */
export function useSaveShortcut(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

/** Suit le thème sombre (classe .dark sur <html>). */
export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Facteur d'échelle pour faire tenir une largeur fixe (feuille A4) dans son conteneur. */
export function useFitScale(contentWidth: number, padding = 48) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width - padding;
      setScale(Math.max(0.45, Math.min(1, w / contentWidth)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentWidth, padding]);
  return { ref, scale };
}
