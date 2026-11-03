import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { COMPANY_KINDS, COMPANY_STATUSES, PRIORITIES } from '../../../shared/constants';
import type { Company, Location } from '../../../shared/types';
import { Button, IconButton } from '../../components/ui/button';
import { Field, FormGrid, Input, Select, Textarea } from '../../components/ui/form';
import { Dialog } from '../../components/ui/overlay';
import { errorMessage, useSave } from '../../lib/api';
import { useFormState } from '../../lib/form';

const EMPTY = {
  name: '',
  sector: '',
  status: 'a_explorer',
  priority: 'moyenne',
  website: '',
  linkedin: '',
  size: '',
  description: '',
  notes: '',
  locations: [] as Location[],
  kind: 'entreprise',
  member: false,
  my_role: '',
};

export function CompanyForm({
  open,
  onOpenChange,
  company,
  onSaved,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  company?: Company | null;
  onSaved?: (c: Company) => void;
  defaults?: Partial<typeof EMPTY>;
}) {
  const save = useSave('companies');
  const { values, set, bind, reset } = useFormState(EMPTY);

  useEffect(() => {
    if (open) {
      reset(
        company
          ? {
              name: company.name,
              sector: company.sector,
              status: company.status,
              priority: company.priority,
              website: company.website,
              linkedin: company.linkedin,
              size: company.size,
              description: company.description,
              notes: company.notes,
              locations: company.locations ?? [],
              kind: company.kind || 'entreprise',
              member: !!company.member,
              my_role: company.my_role ?? '',
            }
          : { ...EMPTY, ...defaults },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company, reset]);

  const setLoc = (i: number, patch: Partial<Location>) =>
    set(
      'locations',
      values.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    );

  const submit = async () => {
    try {
      const saved = await save.mutateAsync({
        id: company?.id,
        ...values,
        locations: values.locations.filter((l) => l.label || l.city || l.address),
        my_role: values.member ? values.my_role : '',
      });
      toast.success(company ? 'Entreprise mise à jour' : 'Entreprise ajoutée');
      onOpenChange(false);
      onSaved?.(saved);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={company ? `Modifier ${company.name}` : 'Nouvelle entreprise'}
      size="lg"
      onSubmit={submit}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || !values.name.trim()}>
            {company ? 'Enregistrer' : "Ajouter l'entreprise"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormGrid>
          <Field label="Nom *">{(id) => <Input id={id} {...bind('name')} placeholder="ex. Airbus, The Shift Project, AX…" required />}</Field>
          <Field label="Type">{(id) => <Select id={id} {...bind('kind')} options={COMPANY_KINDS} />}</Field>
          <Field label="Secteur">{(id) => <Input id={id} {...bind('sector')} placeholder="ex. Aéronautique, climat…" />}</Field>
          <Field label="Statut">{(id) => <Select id={id} {...bind('status')} options={COMPANY_STATUSES} />}</Field>
          <Field label="Priorité">{(id) => <Select id={id} {...bind('priority')} options={PRIORITIES} />}</Field>
          <Field label="Site web">{(id) => <Input id={id} {...bind('website')} placeholder="https://…" />}</Field>
          <Field label="Page LinkedIn">{(id) => <Input id={id} {...bind('linkedin')} placeholder="https://linkedin.com/company/…" />}</Field>
          <Field label="Taille / effectif">{(id) => <Input id={id} {...bind('size')} placeholder="ex. 5 000 salariés, ETI…" />}</Field>
        </FormGrid>

        <div className="rounded-xl border border-line bg-surface-2/50 p-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
            <input type="checkbox" checked={values.member} onChange={(e) => set('member', e.target.checked)} className="size-4 accent-[var(--accent)]" />
            <span>
              <span className="font-medium">J'en fais partie</span>
              <span className="text-ink-3"> · apparaît dans « Mes réseaux » (onglet Networking)</span>
            </span>
          </label>
          {values.member && (
            <Field label="Mon rôle" className="mt-3">
              {(id) => <Input id={id} {...bind('my_role')} placeholder="ex. Shifter (bénévole), membre, alumni X2015, ancien salarié…" />}
            </Field>
          )}
        </div>

        <Field label="Description">
          {(id) => <Textarea id={id} {...bind('description')} placeholder="Activité, actualité, ce qui vous attire…" />}
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-ink-2">Localisations</span>
            <Button
              size="xs"
              variant="ghost"
              icon={<Plus />}
              onClick={() => set('locations', [...values.locations, { label: '', city: '', address: '' }])}
            >
              Ajouter un site
            </Button>
          </div>
          {values.locations.length === 0 ? (
            <button
              type="button"
              onClick={() => set('locations', [{ label: 'Siège', city: '', address: '' }])}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line py-3 text-[12.5px] text-ink-3 hover:border-line-strong hover:text-ink-2"
            >
              <MapPin className="size-3.5" /> Ajouter une localisation (siège, agence, site…)
            </button>
          ) : (
            <div className="space-y-2">
              {values.locations.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.6fr_auto] gap-2">
                  <Input value={l.label} onChange={(e) => setLoc(i, { label: e.target.value })} placeholder="Site (ex. Siège)" aria-label="Nom du site" />
                  <Input value={l.city} onChange={(e) => setLoc(i, { city: e.target.value })} placeholder="Ville" aria-label="Ville" />
                  <Input value={l.address} onChange={(e) => setLoc(i, { address: e.target.value })} placeholder="Adresse (facultatif)" aria-label="Adresse" />
                  <IconButton
                    label="Retirer"
                    size="md"
                    onClick={() =>
                      set(
                        'locations',
                        values.locations.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Notes">{(id) => <Textarea id={id} {...bind('notes')} placeholder="Notes personnelles" />}</Field>
      </div>
    </Dialog>
  );
}
