import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { Option } from '../../shared/constants';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Valeur de tri (absente = colonne non triable). */
  sort?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
}

/** Tableau triable, sobre ; les lignes sont cliquables si `onRowClick`. */
export function DataTable<T extends { id: number }>({
  rows,
  columns,
  onRowClick,
  initialSort,
  empty,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      // valeurs vides toujours en dernier
      if (va == null || va === '') return 1;
      if (vb == null || vb === '') return -1;
      const r =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base', numeric: true });
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sort]);

  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={clsx(
                    'h-9 px-3 text-left text-[11.5px] font-medium whitespace-nowrap text-ink-3 first:pl-4 last:pr-4',
                    c.headerClassName,
                  )}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' },
                        )
                      }
                      className={clsx('inline-flex items-center gap-1 hover:text-ink-2', active && 'text-ink-2')}
                    >
                      {c.header}
                      {active && (sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                'border-b border-line last:border-0',
                onRowClick && 'cursor-pointer transition-colors hover:bg-surface-2/70',
                rowClassName?.(row),
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx('h-12 px-3 align-middle first:pl-4 last:pr-4', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative', className ?? 'w-64')}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-line bg-surface pr-7 pl-8 text-[13px] text-ink shadow-xs outline-none placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-[3px] focus:ring-accent/15"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Filtre compact (liste déroulante native) pour la barre de filtres. */
export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly Option[];
  allLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'h-8 cursor-pointer appearance-none rounded-lg border bg-surface bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7 pl-2.5 text-[12.5px] font-medium shadow-xs outline-none hover:border-line-strong focus:border-accent',
        value ? 'border-line-strong text-ink' : 'border-line text-ink-2',
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8983' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FilterBar({ children, count }: { children: ReactNode; count?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      {count !== undefined && <span className="ml-auto text-[12.5px] text-ink-3">{count}</span>}
    </div>
  );
}

/** Recherche insensible à la casse et aux accents. */
export function matches(query: string, ...fields: unknown[]) {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  const hay = norm(fields.filter(Boolean).join(' '));
  return q.split(/\s+/).every((t) => hay.includes(t));
}
