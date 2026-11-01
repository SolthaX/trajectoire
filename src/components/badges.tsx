import * as RMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { PRIORITIES, type ColorKey, type Option } from '../../shared/constants';
import { fmtScore } from '../lib/format';

export function Dot({ color, className }: { color?: ColorKey; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx('inline-block shrink-0 rounded-full', className ?? 'size-2')}
      style={{ background: color ? `var(--c-${color})` : 'var(--c-gray)' }}
    />
  );
}

export function StatusBadge({
  options,
  value,
  className,
}: {
  options: readonly Option[];
  value: string | null | undefined;
  className?: string;
}) {
  const opt = options.find((o) => o.value === value);
  if (!opt) return <span className="text-ink-3">—</span>;
  return (
    <span
      className={clsx(
        'inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] font-medium whitespace-nowrap text-ink-2',
        className,
      )}
    >
      <Dot color={opt.color} />
      <span className="truncate">{opt.label}</span>
    </span>
  );
}

/** Badge cliquable qui ouvre la liste des statuts. */
export function StatusSelect({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: readonly Option[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const opt = options.find((o) => o.value === value);
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            'group inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface font-medium whitespace-nowrap text-ink-2 shadow-xs transition-colors hover:border-line-strong hover:text-ink data-[state=open]:border-line-strong',
            size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-[30px] px-2.5 text-[12.5px]',
            className,
          )}
        >
          <Dot color={opt?.color} />
          <span className="truncate">{opt?.label ?? 'Choisir…'}</span>
          <ChevronDown className="size-3 text-ink-3 group-hover:text-ink-2" />
        </button>
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align="start"
          sideOffset={5}
          className="anim-menu z-50 min-w-[200px] rounded-xl border border-line bg-surface p-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((o) => (
            <RMenu.Item
              key={o.value}
              onSelect={() => o.value !== value && onChange(o.value)}
              className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] text-ink outline-none select-none data-[highlighted]:bg-surface-2"
            >
              {o.color ? <Dot color={o.color} /> : null}
              <span className="flex-1">{o.label}</span>
              {o.value === value && <Check className="size-3.5 text-ink-2" />}
            </RMenu.Item>
          ))}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/** Icône de priorité : 3 barres (haute), 2 (moyenne), 1 (basse). */
export function PriorityIcon({ value, className }: { value: string; className?: string }) {
  const level = value === 'haute' ? 3 : value === 'moyenne' ? 2 : 1;
  const label = PRIORITIES.find((p) => p.value === value)?.label ?? value;
  return (
    <svg
      viewBox="0 0 14 14"
      className={clsx('shrink-0', className ?? 'size-3.5')}
      role="img"
      aria-label={`Priorité ${label.toLowerCase()}`}
    >
      <title>{`Priorité ${label.toLowerCase()}`}</title>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1.5 + i * 4.25}
          y={9 - i * 3}
          width={2.75}
          height={4 + i * 3}
          rx={0.9}
          fill={i < level ? (level === 3 ? 'var(--c-red)' : 'var(--ink-2)') : 'var(--line-strong)'}
        />
      ))}
    </svg>
  );
}

export function PriorityBadge({ value }: { value: string }) {
  const label = PRIORITIES.find((p) => p.value === value)?.label ?? value;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <PriorityIcon value={value} />
      {label}
    </span>
  );
}

export function PrioritySelect({ value, onChange, size = 'md' }: { value: string; onChange: (v: string) => void; size?: 'sm' | 'md' }) {
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface font-medium text-ink-2 shadow-xs hover:border-line-strong hover:text-ink',
            size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-[30px] px-2.5 text-[12.5px]',
          )}
        >
          <PriorityIcon value={value} />
          {PRIORITIES.find((p) => p.value === value)?.label ?? 'Priorité'}
          <ChevronDown className="size-3 text-ink-3" />
        </button>
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align="start"
          sideOffset={5}
          className="anim-menu z-50 min-w-[160px] rounded-xl border border-line bg-surface p-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {PRIORITIES.map((p) => (
            <RMenu.Item
              key={p.value}
              onSelect={() => p.value !== value && onChange(p.value)}
              className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] text-ink outline-none select-none data-[highlighted]:bg-surface-2"
            >
              <PriorityIcon value={p.value} />
              <span className="flex-1">{p.label}</span>
              {p.value === value && <Check className="size-3.5 text-ink-2" />}
            </RMenu.Item>
          ))}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/** Score sur 5 : valeur + jauge. */
export function ScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score == null) return <span className={clsx('text-[12.5px] text-ink-3', className)}>Non noté</span>;
  return (
    <span className={clsx('inline-flex items-center gap-2', className)} title={`Score pondéré : ${fmtScore(score)} / 5`}>
      <span className="tabular text-[13px] font-semibold text-ink">{fmtScore(score)}</span>
      <span className="relative block h-1.5 w-12 overflow-hidden rounded-full bg-accent-soft">
        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(score / 5) * 100}%` }} />
      </span>
    </span>
  );
}

/** Sélecteur de note 1 à 5 (cliquer à nouveau sur la note l'efface). */
export function ScoreInput({ value, onChange, label }: { value: number | null | undefined; onChange: (v: number | null) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (value ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sur 5`}
            onClick={() => onChange(value === n ? null : n)}
            className={clsx(
              'tabular flex size-7 items-center justify-center rounded-md border text-[12px] font-semibold transition-colors',
              active
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-2',
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/** Logo LinkedIn minimal (l'icône n'existe plus dans lucide). */
export function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'size-[15px]'} fill="currentColor" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z" />
    </svg>
  );
}
