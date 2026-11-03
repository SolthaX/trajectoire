import * as Popover from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, useList, useSave } from '../lib/api';
import { fullName } from '../lib/format';
import { controlClass } from './ui/form';

interface ComboItem {
  id: number;
  label: string;
  sub?: string;
}

interface ComboboxProps {
  id?: string;
  items: ComboItem[];
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  onCreate?: (label: string) => Promise<number | null>;
  createLabel?: (q: string) => string;
  disabled?: boolean;
}

/** Liste déroulante avec recherche (et création à la volée si `onCreate`). */
export function Combobox({
  id,
  items,
  value,
  onChange,
  placeholder = 'Choisir…',
  emptyLabel = 'Aucun résultat',
  onCreate,
  createLabel = (q) => `Créer « ${q} »`,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = items.find((i) => i.id === value);
  const q = query.trim();
  const exact = items.some((i) => i.label.toLowerCase() === q.toLowerCase());

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Popover.Trigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            className={clsx(controlClass, 'flex h-[34px] items-center gap-2 pr-8 pl-3 text-left')}
          >
            <span className={clsx('flex-1 truncate', !selected && 'text-ink-3')}>{selected?.label ?? placeholder}</span>
            {!selected && <ChevronsUpDown className="absolute right-2.5 size-3.5 text-ink-3" />}
          </button>
        </Popover.Trigger>
        {selected && !disabled && (
          <button
            type="button"
            aria-label="Retirer"
            onClick={() => onChange(null)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="anim-menu z-[60] w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        >
          <Command loop>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Rechercher…"
              className="h-9 w-full border-b border-line bg-transparent px-3 text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-2.5 text-[12.5px] text-ink-3">{emptyLabel}</Command.Empty>
              {items.map((it) => (
                <Command.Item
                  key={it.id}
                  value={`${it.label} ${it.sub ?? ''} #${it.id}`}
                  onSelect={() => {
                    onChange(it.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink data-[selected=true]:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{it.label}</span>
                    {it.sub && <span className="block truncate text-[11.5px] text-ink-3">{it.sub}</span>}
                  </span>
                  {it.id === value && <Check className="size-3.5 text-ink-2" />}
                </Command.Item>
              ))}
              {onCreate && q && !exact && (
                <Command.Item
                  value={`__create__ ${q}`}
                  forceMount
                  onSelect={async () => {
                    const newId = await onCreate(q);
                    if (newId) onChange(newId);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-accent-ink data-[selected=true]:bg-surface-2"
                >
                  <Plus className="size-3.5" /> {createLabel(q)}
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CompanyPicker({
  id,
  value,
  onChange,
  allowCreate = true,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  allowCreate?: boolean;
}) {
  const { data = [] } = useList('companies');
  const save = useSave('companies');
  return (
    <Combobox
      id={id}
      items={data.map((c) => ({ id: c.id, label: c.name, sub: c.sector || undefined }))}
      value={value}
      onChange={onChange}
      placeholder="Aucune entreprise"
      emptyLabel="Aucune entreprise — tapez un nom pour la créer"
      onCreate={
        allowCreate
          ? async (name) => {
              try {
                const c = await save.mutateAsync({ name });
                toast.success(`Entreprise « ${name} » créée`);
                return c.id;
              } catch (e) {
                toast.error(errorMessage(e));
                return null;
              }
            }
          : undefined
      }
    />
  );
}

export function ContactPicker({
  id,
  value,
  onChange,
  companyId,
  exclude,
  placeholder = 'Aucun contact',
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  companyId?: number | null;
  /** Contacts à ne pas proposer (déjà choisis). */
  exclude?: number[];
  placeholder?: string;
}) {
  const { data = [] } = useList('contacts');
  const items = data
    .filter((c) => !companyId || c.company_id === companyId || c.affiliations?.some((a) => a.company_id === companyId) || c.id === value)
    .filter((c) => !exclude?.includes(c.id))
    .map((c) => ({ id: c.id, label: fullName(c), sub: [c.role, c.company_name].filter(Boolean).join(' · ') || undefined }));
  return <Combobox id={id} items={items} value={value} onChange={onChange} placeholder={placeholder} emptyLabel="Aucun contact" />;
}

export function JobPicker({
  id,
  value,
  onChange,
  companyId,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  companyId?: number | null;
}) {
  const { data = [] } = useList('jobs');
  const items = data
    .filter((j) => !companyId || j.company_id === companyId || j.id === value)
    .map((j) => ({ id: j.id, label: j.title, sub: [j.company_name, j.location].filter(Boolean).join(' · ') || undefined }));
  return <Combobox id={id} items={items} value={value} onChange={onChange} placeholder="Aucune offre" emptyLabel="Aucune offre" />;
}
