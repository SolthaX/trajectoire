import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import type { Option } from '../../../shared/constants';

export const controlClass = clsx(
  'w-full rounded-lg border border-line bg-surface text-[13px] text-ink shadow-xs outline-none transition-[border-color,box-shadow]',
  'placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-[3px] focus:ring-accent/15',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(controlClass, 'h-[34px] px-3', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(controlClass, 'min-h-[72px] resize-y px-3 py-2 leading-relaxed [field-sizing:content]', className)}
      {...props}
    />
  );
});

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: readonly Option[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, ...props },
  ref,
) {
  return (
    <div className={clsx('relative', className)}>
      <select ref={ref} className={clsx(controlClass, 'h-[34px] appearance-none pr-8 pl-3')} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
    </div>
  );
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Libellé + contrôle + aide. Le contrôle reçoit l'id à poser. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[12px] font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Grille de formulaire responsive. */
export function FormGrid({ children, cols = 2, className }: { children: ReactNode; cols?: 1 | 2 | 3; className?: string }) {
  return (
    <div
      className={clsx(
        'grid gap-x-4 gap-y-4',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && 'grid-cols-1 sm:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Groupe de boutons à choix unique (segmented control). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: readonly { value: V; label: ReactNode }[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={clsx('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors [&_svg]:size-3.5',
            size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-7 px-3 text-[12.5px]',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
