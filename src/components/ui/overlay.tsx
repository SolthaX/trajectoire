import * as RDialog from '@radix-ui/react-dialog';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { Check, X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';

// --- Fenêtre modale -----------------------------------------------------------
const DIALOG_SIZES = {
  sm: 'w-[min(420px,calc(100vw-32px))]',
  md: 'w-[min(560px,calc(100vw-32px))]',
  lg: 'w-[min(720px,calc(100vw-32px))]',
  xl: 'w-[min(960px,calc(100vw-32px))]',
};

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof DIALOG_SIZES;
  /** Formulaire : la touche Entrée (et Ctrl+Entrée dans les zones de texte) soumet. */
  onSubmit?: () => void;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', onSubmit }: DialogProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
        <div className="min-w-0">
          <RDialog.Title className="text-[15px] font-semibold tracking-tight text-ink">{title}</RDialog.Title>
          {description ? (
            <RDialog.Description className="mt-0.5 text-[13px] text-ink-3">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Fenêtre'}</RDialog.Description>
          )}
        </div>
        <RDialog.Close className="-mt-0.5 -mr-2 rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Fermer">
          <X className="size-4" />
        </RDialog.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-6 py-3.5">{footer}</div>
      )}
    </>
  );
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[rgb(15_15_14/0.32)] backdrop-blur-[1.5px]" />
        <RDialog.Content
          className={clsx(
            'anim-dialog fixed top-[8vh] left-1/2 z-50 flex max-h-[84vh] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg outline-none',
            DIALOG_SIZES[size],
          )}
          onOpenAutoFocus={(e) => {
            // Focus sur le premier champ plutôt que sur le bouton de fermeture.
            const root = e.currentTarget as HTMLElement;
            const field = root.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select');
            if (field) {
              e.preventDefault();
              field.focus();
            }
          }}
        >
          {onSubmit ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            >
              {body}
            </form>
          ) : (
            body
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

// --- Panneau latéral ------------------------------------------------------------
interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Sheet({ open, onOpenChange, title, children, width = 'w-[min(560px,100vw)]' }: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="anim-overlay fixed inset-0 z-40 bg-[rgb(15_15_14/0.18)]" />
        <RDialog.Content
          className={clsx(
            'anim-sheet fixed inset-y-0 right-0 z-50 flex flex-col border-l border-line bg-surface shadow-lg outline-none',
            width,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <RDialog.Title className="sr-only">{title}</RDialog.Title>
          <RDialog.Description className="sr-only">{title}</RDialog.Description>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export const SheetClose = RDialog.Close;

// --- Menu déroulant -------------------------------------------------------------
export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export function Menu({
  trigger,
  items,
  align = 'end',
  width = 'min-w-[200px]',
  header,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end' | 'center';
  width?: string;
  header?: ReactNode;
}) {
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align={align}
          sideOffset={6}
          className={clsx('anim-menu z-50 rounded-xl border border-line bg-surface p-1 shadow-md', width)}
          onClick={(e) => e.stopPropagation()}
        >
          {header && <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-ink-3 uppercase">{header}</div>}
          {items.map((it, i) =>
            it.separator ? (
              <RMenu.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <RMenu.Item
                key={i}
                disabled={it.disabled}
                onSelect={() => it.onSelect?.()}
                className={clsx(
                  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] outline-none select-none data-[disabled]:opacity-40 [&_svg]:size-[15px]',
                  it.danger
                    ? 'text-danger data-[highlighted]:bg-danger-soft'
                    : 'text-ink data-[highlighted]:bg-surface-2',
                )}
              >
                {it.icon && <span className="flex text-ink-3">{it.icon}</span>}
                <span className="flex-1 truncate">{it.label}</span>
                {it.checked && <Check className="text-ink-2" />}
              </RMenu.Item>
            ),
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

// --- Confirmation -----------------------------------------------------------------
interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setState(o);
      }),
    [],
  );
  const close = (v: boolean) => {
    resolver.current?.(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onOpenChange={(o) => !o && close(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>Annuler</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel ?? 'Confirmer'}
            </Button>
          </>
        }
      >
        {state?.message && <div className="text-[13px] leading-relaxed text-ink-2">{state.message}</div>}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
