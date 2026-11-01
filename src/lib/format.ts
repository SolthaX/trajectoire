import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const parse = (iso: string) => parseISO(iso.length <= 10 ? `${iso}T00:00:00` : iso);

/** « 12 nov. 2026 » (année omise si c'est l'année en cours). */
export function fmtDate(iso?: string | null, opts: { year?: boolean } = {}) {
  if (!iso) return '—';
  const d = parse(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, opts.year || !sameYear ? 'd MMM yyyy' : 'd MMM', { locale: fr });
}

/** « mar. 12 nov. · 14:30 » */
export function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = parse(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? "EEE d MMM '·' HH:mm" : "EEE d MMM yyyy '·' HH:mm", { locale: fr });
}

export function fmtTime(iso?: string | null) {
  if (!iso || iso.length <= 10) return '';
  return format(parse(iso), 'HH:mm');
}

/** « 1er novembre 2026 » — pour les lettres et mails. */
export function fmtLongDate(d = new Date()) {
  const day = d.getDate() === 1 ? '1er' : String(d.getDate());
  return `${day} ${format(d, 'MMMM yyyy', { locale: fr })}`;
}

/** Nombre de jours entre aujourd'hui et la date (négatif = passé). */
export function daysFromToday(iso: string) {
  return differenceInCalendarDays(parse(iso), new Date());
}

/** « aujourd'hui », « demain », « dans 3 j », « il y a 2 j » */
export function fmtRelativeDay(iso?: string | null) {
  if (!iso) return '';
  const n = daysFromToday(iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 1) return n < 14 ? `dans ${n} j` : `le ${fmtDate(iso)}`;
  return -n < 14 ? `il y a ${-n} j` : `le ${fmtDate(iso)}`;
}

export function fmtAgo(iso?: string | null) {
  if (!iso) return '';
  const d = parse(iso);
  if (Math.abs(Date.now() - d.getTime()) < 45_000) return "à l'instant";
  return formatDistanceToNowStrict(d, { locale: fr, addSuffix: true });
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function nowLocalISO() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function addDaysISO(n: number, from?: string) {
  const d = from ? parse(from) : new Date();
  d.setDate(d.getDate() + n);
  return format(d, 'yyyy-MM-dd');
}

export function fullName(c?: { first_name?: string; last_name?: string; email?: string } | null) {
  if (!c) return '';
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || 'Sans nom';
}

export function initials(name: string) {
  return (
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function fmtScore(s?: number | null) {
  if (s == null) return '—';
  return s.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtPercent(n: number, total: number) {
  if (!total) return '—';
  return `${Math.round((n / total) * 100)} %`;
}

/** Ajoute https:// si besoin. */
export function ensureUrl(url: string) {
  const u = url.trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

export function hostname(url: string) {
  try {
    return new URL(ensureUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function plural(n: number, one: string, many?: string) {
  return `${n} ${n > 1 ? (many ?? `${one}s`) : one}`;
}
