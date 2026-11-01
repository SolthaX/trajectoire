import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import type { Interview } from '../../../shared/types';
import { Button } from '../../components/ui/button';
import { EmptyState, Loading, PageHeader, Section } from '../../components/ui/misc';
import { useList } from '../../lib/api';
import { daysFromToday, todayISO } from '../../lib/format';
import { useNewParam } from '../../lib/hooks';
import { InterviewForm } from './InterviewForm';
import { InterviewRow } from './InterviewList';

function dayLabel(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  const label = format(parseISO(iso), 'EEEE d MMMM', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function InterviewsPage() {
  const { data = [], isLoading } = useList('interviews');
  const [editing, setEditing] = useState<Interview | null>(null);
  const [open, setOpen] = useState(false);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  const today = todayISO();
  const upcoming = data
    .filter((iv) => iv.status === 'prevu' && iv.scheduled_at.slice(0, 10) >= today)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = data
    .filter((iv) => !upcoming.includes(iv))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  const groups: { day: string; items: Interview[] }[] = [];
  for (const iv of upcoming) {
    const day = iv.scheduled_at.slice(0, 10);
    const g = groups.find((x) => x.day === day);
    if (g) g.items.push(iv);
    else groups.push({ day, items: [iv] });
  }

  const edit = (iv: Interview) => {
    setEditing(iv);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Entretiens"
        description="Préparez vos entretiens et gardez une trace des retours."
        actions={
          <Button
            variant="primary"
            icon={<CalendarPlus />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Nouvel entretien
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="Aucun entretien planifié"
          description="Ajoutez vos entretiens avec leur préparation, puis le compte rendu et le retour."
          action={
            <Button variant="primary" icon={<CalendarPlus />} onClick={() => setOpen(true)}>
              Planifier un entretien
            </Button>
          }
        />
      ) : (
        <div className="max-w-3xl space-y-8">
          <Section title={`À venir · ${upcoming.length}`}>
            {groups.length === 0 ? (
              <p className="text-[13px] text-ink-3">Rien de prévu pour l'instant.</p>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g.day}>
                    <div className="mb-2 text-[13px] font-medium text-ink">{dayLabel(g.day)}</div>
                    <ul className="space-y-2">
                      {g.items.map((iv) => (
                        <InterviewRow key={iv.id} iv={iv} onOpen={() => edit(iv)} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
          {past.length > 0 && (
            <Section title={`Passés et annulés · ${past.length}`}>
              <ul className="space-y-2">
                {past.map((iv) => (
                  <InterviewRow key={iv.id} iv={iv} onOpen={() => edit(iv)} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
      <InterviewForm open={open} onOpenChange={setOpen} interview={editing} />
    </>
  );
}
