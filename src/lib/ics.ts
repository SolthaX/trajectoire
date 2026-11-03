// Export iCalendar (.ics) des événements de networking, à ouvrir dans Calendrier (iPhone),
// Outlook ou Google Agenda. Rien n'est publié : le fichier est seulement téléchargé.

import { labelOf, EVENT_KINDS } from '../../shared/constants';
import type { NetworkEvent } from '../../shared/types';

/** Statuts exclus de l'export groupé. */
export const ICS_EXCLUDED_STATUSES = ['annule', 'pas_alle'];

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Replie les lignes à 75 octets (RFC 5545), sans couper un caractère UTF-8. */
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** « 2026-11-04T19:00 » → « 20261104T190000 » (heure locale de l'appareil, sans fuseau). */
const localStamp = (iso: string) => {
  const [d, t = '00:00'] = iso.split('T');
  return `${d.replace(/-/g, '')}T${t.replace(/:/g, '').padEnd(6, '0').slice(0, 6)}`;
};

function plusHours(iso: string, h: number) {
  const d = new Date(iso);
  d.setHours(d.getHours() + h);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const utcStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

function vevent(ev: NetworkEvent) {
  const description = [
    ev.organizer_name && `Organisateur : ${ev.organizer_name}`,
    labelOf(EVENT_KINDS, ev.kind),
    ev.link && `Visio : ${ev.link}`,
    ev.url && `Page de l'événement : ${ev.url}`,
  ]
    .filter(Boolean)
    .join('\n');
  const lines = [
    'BEGIN:VEVENT',
    // UID stable : réimporter le même événement le met à jour au lieu de le dupliquer (selon l'agenda).
    `UID:trajectoire-event-${ev.id}@solthax.github.io`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART:${localStamp(ev.starts_at)}`,
    `DTEND:${localStamp(ev.ends_at && ev.ends_at > ev.starts_at ? ev.ends_at : plusHours(ev.starts_at, 2))}`,
    `SUMMARY:${escape(ev.status === 'repere' ? `${ev.name} (repéré)` : ev.name)}`,
    ev.place && `LOCATION:${escape(ev.place)}`,
    (ev.url || ev.link) && `URL:${ev.url || ev.link}`,
    description && `DESCRIPTION:${escape(description)}`,
    `STATUS:${ev.status === 'repere' ? 'TENTATIVE' : 'CONFIRMED'}`,
    'END:VEVENT',
  ];
  return lines.filter(Boolean) as string[];
}

export function buildIcs(events: NetworkEvent[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trajectoire//Networking//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Trajectoire · Networking'];
  for (const ev of events) lines.push(...vevent(ev));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(events: NetworkEvent[], filename: string) {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function icsFilename(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${slug || 'evenement'}.ics`;
}
