import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.015em] text-ink">{title}</h1>
          {description && <p className="mt-1 text-[13.5px] text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={clsx('rounded-xl border border-line bg-surface shadow-xs', padded && 'p-5', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}>
      {icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3 [&_svg]:size-[18px]">
          {icon}
        </div>
      )}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-balance text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-ink-3', className ?? 'size-4')} />;
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-ink-3">
      <Spinner /> {label}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[10.5px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx('flex gap-5 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            '-mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 text-[13px] font-medium transition-colors',
            value === t.key ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={clsx(
                'tabular rounded-full px-1.5 text-[11px] leading-[18px]',
                value === t.key ? 'bg-ink text-bg' : 'bg-surface-3 text-ink-3',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  // Teinte stable dérivée du nom, très désaturée pour rester sobre.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initials =
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide',
        className ?? 'size-7',
      )}
      style={{
        background: `color-mix(in oklch, oklch(0.72 0.06 ${h}) 28%, var(--surface-2))`,
        color: `color-mix(in oklch, oklch(0.42 0.08 ${h}) 75%, var(--ink))`,
      }}
    >
      {initials}
    </span>
  );
}

/** Jauge fine (score sur 5, progression…). */
export function Meter({ value, max = 5, className }: { value: number | null | undefined; max?: number; className?: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <span className={clsx('relative block h-1.5 overflow-hidden rounded-full bg-accent-soft', className ?? 'w-16')}>
      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Section({ title, actions, children, className }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Ligne « libellé : valeur » pour les fiches. */
export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 py-1.5 text-[13px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}
