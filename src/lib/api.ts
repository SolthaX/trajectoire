import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  Company,
  Contact,
  Criterion,
  Interaction,
  Interview,
  Job,
  Project,
  Settings,
  Template,
} from '../../shared/types';
import { backendFetch } from '../backend/app';

export class ApiError extends Error {}

// L'API est servie par le backend embarqué (SQLite dans le navigateur), pas par le réseau.
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await backendFetch(
    new Request(`https://trajectoire.local/api${url}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
  const isJson = res.headers.get('content-type')?.includes('json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (isJson && (data as { error?: string })?.error) || `Erreur ${res.status}`;
    throw new ApiError(msg);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  del: <T>(url: string) => request<T>('DELETE', url),
};

export interface ResourceMap {
  companies: Company;
  projects: Project;
  contacts: Contact;
  jobs: Job;
  interviews: Interview;
  interactions: Interaction;
  templates: Template;
  criteria: Criterion;
}
export type Resource = keyof ResourceMap;

type Params = Record<string, string | number | null | undefined>;

export function toQuery(params?: Params) {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v === null ? 'null' : String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * Après une écriture, on rafraîchit toutes les données de l'app (hors fichiers,
 * pour ne pas écraser un document en cours d'édition). Volume local : c'est instantané.
 */
export function refreshAll(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'files' });
}

export function useList<R extends Resource>(resource: R, params?: Params, options?: { enabled?: boolean }) {
  const qs = toQuery(params);
  return useQuery({
    queryKey: [resource, 'list', qs],
    queryFn: () => api.get<ResourceMap[R][]>(`/${resource}${qs}`),
    enabled: options?.enabled ?? true,
  });
}

export function useItem<R extends Resource>(resource: R, id: number | string | null | undefined) {
  return useQuery({
    queryKey: [resource, 'item', String(id)],
    queryFn: () => api.get<ResourceMap[R]>(`/${resource}/${id}`),
    enabled: id != null && id !== '',
  });
}

/** Création (sans id) ou modification partielle (avec id). */
export function useSave<R extends Resource>(resource: R) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<ResourceMap[R]> & { id?: number }) =>
      id ? api.patch<ResourceMap[R]>(`/${resource}/${id}`, data) : api.post<ResourceMap[R]>(`/${resource}`, data),
    onSuccess: () => refreshAll(qc),
  });
}

export function useRemove(resource: Resource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/${resource}/${id}`),
    onSuccess: () => refreshAll(qc),
  });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings') });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Settings>) => api.put<Settings>('/settings', data),
    onSuccess: () => refreshAll(qc),
  });
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
