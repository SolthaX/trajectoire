import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'accent';
export type ButtonSize = 'xs' | 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-bg hover:bg-ink/85 shadow-sm',
  accent: 'bg-accent text-on-accent hover:bg-accent/90 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong shadow-xs',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[12px] gap-1 rounded-md',
  sm: 'h-7 px-2.5 text-[12.5px] gap-1.5 rounded-md',
  md: 'h-[34px] px-3.5 text-[13px] gap-1.5 rounded-lg',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  xs: 'size-6 rounded-md',
  sm: 'size-7 rounded-md',
  md: 'size-[34px] rounded-lg',
};

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return clsx(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow] duration-100',
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:shrink-0',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'sm', label, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(buttonClass(variant, size), ICON_SIZES[size], 'px-0', className)}
      {...props}
    >
      {children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, typeof className === 'string' ? className : undefined)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
