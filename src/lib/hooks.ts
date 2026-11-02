import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/** Ouvre / ferme le panneau contact via ?contact=ID (fonctionne sur toutes les pages). */
export function useContactSheet() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('contact');
  const open = useCallback(
    (id: number) =>
      setParams((p) => {
        p.set('contact', String(id));
        return p;
      }),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete('contact');
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { id: raw ? Number(raw) : null, open, close };
}

/** Paramètre ?new=1 : ouvre le formulaire de création (depuis la palette de commandes). */
export function useNewParam(onNew: () => void) {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      onNew();
      setParams(
        (p) => {
          p.delete('new');
          return p;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', next ? '#0f414a' : '#0f414a');
      try {
        localStorage.setItem('trajectoire:theme', next ? 'dark' : 'light');
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  }, []);
  return { dark, toggle };
}

/** Préférence d'affichage mémorisée (clé préfixée : l'origine github.io est partagée avec d'autres apps). */
export function useLocalState<T>(rawKey: string, initial: T) {
  const key = `trajectoire:${rawKey}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Raccourci clavier global (ex. « mod+k »). */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop();
    const mod = parts.includes('mod');
    const shift = parts.includes('shift');
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return;
      if (mod !== (e.ctrlKey || e.metaKey)) return;
      if (shift !== e.shiftKey) return;
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler, enabled]);
}

export function useDebounced<T>(value: T, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
