import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useRef, useState } from 'react';
import type { ColorKey } from '../../../shared/constants';
import { Dot } from '../../components/badges';

/**
 * Histogramme d'activité hebdomadaire (une seule série → pas de légende, le titre la nomme).
 * Colonnes ≤ 24 px, extrémité arrondie 4 px, base carrée, grille fine, info-bulle au survol.
 */
/** Largeur réelle du conteneur : le SVG est dessiné à l'échelle 1 (textes nets, tailles exactes). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function WeeklyColumns({ data }: { data: { week: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, measured] = useWidth<HTMLDivElement>();
  const W = Math.max(280, measured || 420);
  const H = 176;
  const pad = { top: 20, right: 30, bottom: 24, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.count), 0);
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : Math.ceil(max / 5 / 5) * 5;
  const top = Math.max(step * Math.ceil(max / step), step * 2);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const band = innerW / data.length;
  const barW = Math.min(24, band * 0.62);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const last = data.length - 1;

  const weekLabel = (iso: string) => format(parseISO(iso), 'd MMM', { locale: fr }).replace('.', '');

  return (
    <div ref={ref} className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Actions par semaine sur les 12 dernières semaines">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth={1} shapeRendering="crispEdges" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--ink-3)] text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * band + (band - barW) / 2;
          const h = (d.count / top) * innerH;
          const r = Math.min(4, h);
          const yTop = pad.top + innerH - h;
          const path =
            h > 0
              ? `M${x},${pad.top + innerH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${pad.top + innerH} Z`
              : '';
          const showLabel = i % 2 === last % 2;
          return (
            <g key={d.week}>
              {path && <path d={path} fill="var(--coral)" opacity={hover == null || hover === i ? 1 : 0.45} />}
              {i === last && d.count > 0 && (
                <text x={x + barW / 2} y={yTop - 5} textAnchor="middle" className="tabular fill-[var(--ink)] text-[11px] font-semibold">
                  {d.count}
                </text>
              )}
              {showLabel && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="fill-[var(--ink-3)] text-[11px]">
                  {i === last ? 'Cette sem.' : weekLabel(d.week)}
                </text>
              )}
              {/* zone de survol plus large que la colonne */}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`Semaine du ${weekLabel(d.week)} : ${d.count} action${d.count > 1 ? 's' : ''}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-md"
          style={{
            left: `${((pad.left + hover * band + band / 2) / W) * 100}%`,
            top: `${(y(data[hover].count) / H) * 100}%`,
            marginTop: -8,
          }}
        >
          <div className="text-ink-3">Semaine du {weekLabel(data[hover].week)}</div>
          <div className="tabular font-semibold text-ink">
            {data[hover].count} action{data[hover].count > 1 ? 's' : ''}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>Actions par semaine</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.week}>
              <th>{d.week}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Entonnoir : barres horizontales d'une seule teinte, valeur en bout de barre, taux de passage. */
export function Funnel({ steps }: { steps: { key: string; label: string; count: number }[] }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <ol className="space-y-3.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const rate = prev ? Math.round((s.count / prev) * 100) : null;
        return (
          <li key={s.key} title={`${s.label} : ${s.count}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="text-ink-2">{s.label}</span>
              {rate != null && <span className="tabular text-[11.5px] text-ink-3">{rate} % de l'étape précédente</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[18px] flex-1">
                <div
                  className="h-full rounded-r-[4px] bg-accent transition-[width] duration-300"
                  style={{ width: `${(s.count / max) * 100}%`, minWidth: s.count > 0 ? 3 : 0 }}
                />
              </div>
              <span className="tabular w-8 text-right text-[13px] font-semibold text-ink">{s.count}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Liste de barres libellées (identité portée par le libellé + pastille, pas par la couleur seule). */
export function BarList({ rows }: { rows: { key: string; label: string; color?: ColorKey; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,150px)_1fr_28px] items-center gap-3 text-[12.5px]" title={`${r.label} : ${r.count}`}>
          <span className="flex min-w-0 items-center gap-2 text-ink-2">
            <Dot color={r.color} />
            <span className="truncate">{r.label}</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-[var(--ink-3)]" style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count > 0 ? 3 : 0 }} />
          </span>
          <span className="tabular text-right font-semibold text-ink">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
