import { useCallback, useState, type ChangeEvent } from 'react';

/** État de formulaire minimal : valeurs + liaison des champs texte. */
export function useFormState<T extends Record<string, any>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setValues((s) => ({ ...s, [key]: value })), []);
  const bind = <K extends keyof T>(key: K) => ({
    value: (values[key] ?? '') as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, e.target.value as T[K]),
  });
  return { values, set, setValues, bind, reset: setValues };
}
