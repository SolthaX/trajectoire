import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Circle,
  FolderOpen,
  Handshake,
  Plus,
  Send,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { CONTACT_STATUSES, INTERACTION_TYPES, INTERVIEW_KINDS, labelOf } from '../../../shared/constants';
import type { DashboardData } from '../../../shared/types';
import { ScoreBadge } from '../../components/badges';
import { ButtonLink } from '../../components/ui/button';
import { Card, CardHeader, Loading } from '../../components/ui/misc';
import { api, useSettings } from '../../lib/api';
import { daysFromToday, fmtAgo, fmtDateTime, fmtPercent, fmtRelativeDay, fullName } from '../../lib/format';
import { useContactSheet } from '../../lib/hooks';
import { InteractionIcon } from '../interactions/InteractionIcon';
import { CalendarCard } from './CalendarCard';
import { BarList, Funnel, WeeklyColumns } from './charts';

const TONES = {
  sky: 'border-t-sky bg-sky-soft',
  coral: 'border-t-coral bg-coral-soft',
  saffron: 'border-t-saffron bg-saffron-soft',
  plum: 'border-t-plum bg-plum-soft',
  sage: 'border-t-sage bg-sage-soft',
  tan: 'border-t-tan bg-tan-soft',
} as const;

function StatTile({ label, value, sub, to, tone = 'sky' }: { label: string; value: ReactNode; sub?: ReactNode; to: string; tone?: keyof typeof TONES }) {
  return (
    <Link to={to} className={clsx('group rounded-xl border border-t-4 border-line p-4 shadow-xs transition-colors hover:border-line-strong', TONES[tone])}>
      <div className="text-[12.5px] font-medium text-ink-2">{label}</div>
      <div className="mt-1.5 text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">{value}</div>
      <div className="mt-2 h-4 text-[12px] text-ink-3">{sub}</div>
    </Link>
  );
}

interface TodoItem {
  key: string;
  icon: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  tone?: 'danger' | 'warning' | 'normal';
  onClick: () => void;
}

function TodoGroup({ title, items, empty, dot = 'bg-sky' }: { title: string; items: TodoItem[]; empty?: string; dot?: string }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">
        <span className={clsx('size-2 rounded-full', dot)} />
        {title}
        {items.length > 0 && <span className="tabular rounded-full bg-surface-3 px-1.5 text-[10.5px] leading-4 text-ink-2">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="py-1 text-[12.5px] text-ink-3">{empty}</p>
      ) : (
        <ul className="-mx-2">
          {items.map((it) => (
            <li key={it.key}>
              <button
                onClick={it.onClick}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2/80"
              >
                <span
                  className={clsx(
                    'flex size-7 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-3.5',
                    it.tone === 'danger'
                      ? 'border-danger/25 bg-danger-soft text-danger'
                      : it.tone === 'warning'
                        ? 'border-warning-ink/25 bg-warning-soft text-warning-ink'
                        : 'border-line bg-surface-2 text-ink-2',
                  )}
                >
                  {it.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{it.title}</span>
                  <span className="block truncate text-[12px] text-ink-3">{it.meta}</span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Onboarding({ hasProfile }: { hasProfile: boolean }) {
  const steps = [
    { done: hasProfile, label: 'Compléter mon profil (pour les signatures et variables)', to: '/parametres' },
    { done: false, label: 'Ajouter une première entreprise et ses projets', to: '/entreprises?new=1' },
    { done: false, label: 'Ajouter les contacts à approcher', to: '/contacts?new=1' },
    { done: false, label: 'Enregistrer une offre repérée', to: '/offres?new=1' },
    { done: false, label: 'Déposer mon CV LaTeX et mes lettres dans Documents', to: '/documents' },
  ];
  return (
    <Card className="mb-6">
      <CardHeader title="Bienvenue 👋" subtitle="Quelques étapes pour bien démarrer. Ce panneau disparaît dès que vous avez des données." />
      <ol className="grid gap-1 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {s.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-ink-3" />}
              <span className={s.done ? 'line-through' : undefined}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { open: openContact } = useContactSheet();
  const { data: settings } = useSettings();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });

  if (isLoading || !data) return <Loading />;
  const { kpis } = data;
  const firstName = settings?.profile.first_name;
  const isEmpty = kpis.companies === 0 && data.funnel[0].count === 0 && data.contact_statuses.length === 0;
  const dateLabel = format(new Date(), 'EEEE d MMMM', { locale: fr });

  const followups: TodoItem[] = data.followups.map((c) => ({
    key: `f${c.id}`,
    icon: <Bell />,
    tone: c.overdue_days > 0 ? 'danger' : c.overdue_days === 0 ? 'warning' : 'normal',
    title: (
      <>
        Relancer <span className="font-medium">{fullName(c)}</span>
        {c.company_name && <span className="text-ink-3"> · {c.company_name}</span>}
      </>
    ),
    meta:
      c.overdue_days > 0
        ? `En retard de ${c.overdue_days} j · ${labelOf(CONTACT_STATUSES, c.status)}`
        : `${fmtRelativeDay(c.next_followup)} · ${labelOf(CONTACT_STATUSES, c.status)}`,
    onClick: () => openContact(c.id),
  }));

  const interviews: TodoItem[] = data.upcoming_interviews
    .filter((iv) => daysFromToday(iv.scheduled_at) <= 7)
    .slice(0, 4)
    .map((iv) => ({
      key: `i${iv.id}`,
      icon: <CalendarClock />,
      tone: daysFromToday(iv.scheduled_at) === 0 ? 'warning' : 'normal',
      title: (
        <>
          Entretien {labelOf(INTERVIEW_KINDS, iv.kind)} · <span className="font-medium">{iv.company_name ?? iv.job_title ?? '—'}</span>
        </>
      ),
      meta: `${fmtDateTime(iv.scheduled_at)}${iv.preparation ? '' : ' · préparation à faire'}`,
      onClick: () => navigate(iv.job_id ? `/offres/${iv.job_id}` : '/entretiens'),
    }));

  const events: TodoItem[] = data.upcoming_events
    .filter((ev) => daysFromToday(ev.starts_at) <= 7)
    .map((ev) => ({
      key: `e${ev.id}`,
      icon: <Handshake />,
      tone: daysFromToday(ev.starts_at) === 0 ? 'warning' : 'normal',
      title: (
        <>
          <span className="font-medium">{ev.name}</span>
          {ev.organizer_name && <span className="text-ink-3"> · {ev.organizer_name}</span>}
        </>
      ),
      meta: `${fmtDateTime(ev.starts_at)} · ${ev.status === 'inscrit' ? 'inscrit' : 'inscription à faire'}${ev.preparation ? '' : ' · préparation à faire'}`,
      onClick: () => navigate(`/networking?event=${ev.id}`),
    }));

  const planned: TodoItem[] = data.planned
    .filter((it) => daysFromToday(it.date) <= 7)
    .map((it) => ({
      key: `p${it.id}`,
      icon: <InteractionIcon type={it.type} />,
      tone: daysFromToday(it.date) < 0 ? 'danger' : daysFromToday(it.date) === 0 ? 'warning' : 'normal',
      title: (
        <>
          {labelOf(INTERACTION_TYPES, it.type)} · <span className="font-medium">{it.contact_name || it.company_name || it.subject || '—'}</span>
          {it.subject && (it.contact_name || it.company_name) && <span className="text-ink-3"> · {it.subject}</span>}
        </>
      ),
      meta: fmtDateTime(it.date),
      onClick: () => (it.contact_id ? openContact(it.contact_id) : it.company_id ? navigate(`/entreprises/${it.company_id}`) : undefined),
    }));

  const deadlines: TodoItem[] = data.deadlines.map((j) => ({
    key: `d${j.id}`,
    icon: <Send />,
    tone: 'warning',
    title: (
      <>
        Postuler · <span className="font-medium">{j.title}</span>
        {j.company_name && <span className="text-ink-3"> · {j.company_name}</span>}
      </>
    ),
    meta: `Date limite ${fmtRelativeDay(j.deadline)}`,
    onClick: () => navigate(`/offres/${j.id}`),
  }));

  const priorities: TodoItem[] = [
    ...data.to_apply
      .filter((j) => !data.deadlines.some((d) => d.id === j.id))
      .map((j) => ({
        key: `a${j.id}`,
        icon: <Briefcase />,
        title: (
          <>
            Postuler · <span className="font-medium">{j.title}</span>
          </>
        ),
        meta: [j.company_name, 'priorité haute'].filter(Boolean).join(' · '),
        onClick: () => navigate(`/offres/${j.id}`),
      })),
    ...data.to_contact.map((c) => ({
      key: `c${c.id}`,
      icon: <UserRound />,
      title: (
        <>
          Contacter <span className="font-medium">{fullName(c)}</span>
        </>
      ),
      meta: [c.role, c.company_name, 'priorité haute'].filter(Boolean).join(' · '),
      onClick: () => openContact(c.id),
    })),
  ];

  const totalTodos = planned.length + followups.length + interviews.length + events.length + deadlines.length + priorities.length;
  const statusRows = CONTACT_STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    color: s.color,
    count: data.contact_statuses.find((x) => x.status === s.value)?.count ?? 0,
  }));

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-ink-3 first-letter:uppercase">{dateLabel}</p>
          <h1 className="mt-0.5 text-[24px] leading-tight font-semibold tracking-[-0.015em] text-ink">
            {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/contacts?new=1" icon={<Plus />}>
            Contact
          </ButtonLink>
          <ButtonLink to="/offres?new=1" icon={<Plus />}>
            Offre
          </ButtonLink>
          <ButtonLink to="/entreprises?new=1" variant="primary" icon={<Plus />}>
            Entreprise
          </ButtonLink>
        </div>
      </header>

      {isEmpty && <Onboarding hasProfile={!!firstName} />}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile tone="tan" label="Entreprises suivies" value={kpis.companies} to="/entreprises" sub={<span className="inline-flex items-center gap-1"><Building2 className="size-3" /> hors écartées</span>} />
        <StatTile
          tone="coral"
          label="Contacts approchés"
          value={kpis.contacted}
          to="/contacts"
          sub={kpis.contacted ? `${fmtPercent(kpis.responded, kpis.contacted)} de réponses` : 'aucun pour l’instant'}
        />
        <StatTile tone="sage" label="Candidatures envoyées" value={kpis.applications} to="/offres" sub={kpis.offers ? `${kpis.offers} offre${kpis.offers > 1 ? 's' : ''} reçue${kpis.offers > 1 ? 's' : ''}` : undefined} />
        <StatTile tone="plum" label="Entretiens à venir" value={kpis.interviews_upcoming} to="/entretiens" />
        <StatTile tone="saffron" label="Relances en attente" value={data.followups.filter((f) => f.overdue_days >= 0).length} to="/contacts" sub="aujourd'hui ou en retard" />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-7">
          <CardHeader title="À faire" subtitle={totalTodos ? 'Messages et calls prévus, relances, entretiens, événements et échéances des 7 prochains jours.' : undefined} />
          {totalTodos === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="mb-2 size-6 text-success" />
              <p className="text-[13.5px] font-medium text-ink">Rien d'urgent</p>
              <p className="mt-0.5 max-w-xs text-[12.5px] text-ink-3">Fixez des dates de relance sur vos contacts et des dates limites sur vos offres pour les voir ici.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <TodoGroup title="Messages et calls prévus" items={planned} dot="bg-saffron" />
              <TodoGroup title="Relances" items={followups} dot="bg-coral" />
              <TodoGroup title="Entretiens" items={interviews} dot="bg-plum" />
              <TodoGroup title="Événements" items={events} dot="bg-sky" />
              <TodoGroup title="Échéances" items={deadlines} dot="bg-maroon" />
              <TodoGroup title="Priorités hautes" items={priorities} dot="bg-sage" />
            </div>
          )}
        </Card>

        <div className="min-w-0 lg:col-span-5">
          <CalendarCard />
        </div>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Activité" subtitle="Échanges et candidatures, par semaine (12 semaines)" />
          <WeeklyColumns data={data.weekly} />
        </Card>
        <Card>
          <CardHeader
            title="Projets les mieux notés"
            subtitle="Meilleur score par entreprise"
            actions={
              <Link to="/entreprises" className="text-[12px] text-ink-3 hover:text-ink">
                Tout voir
              </Link>
            }
          />
          {data.top_companies.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">Notez les projets de vos entreprises selon vos critères pour les comparer ici.</p>
          ) : (
            <ul className="-mx-2">
              {data.top_companies.map((c, i) => (
                <li key={c.id}>
                  <Link to={`/entreprises/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2/80">
                    <span className="tabular w-4 text-[12px] text-ink-3">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{c.name}</span>
                    <ScoreBadge score={c.score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Entonnoir des candidatures" />
          <Funnel steps={data.funnel} />
        </Card>
        <Card>
          <CardHeader
            title="Contacts par avancement"
            actions={
              <Link to="/pipeline" className="text-[12px] text-ink-3 hover:text-ink">
                Pipeline
              </Link>
            }
          />
          <BarList rows={statusRows} />
        </Card>
        <Card>
          <CardHeader
            title="Derniers échanges"
            actions={
              <Link to="/contacts" className="text-[12px] text-ink-3 hover:text-ink">
                Contacts
              </Link>
            }
          />
          {data.recent.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">Les mails, appels et rendez-vous notés apparaîtront ici.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.recent.slice(0, 6).map((it) => (
                <li key={it.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-2">
                    <InteractionIcon type={it.type} className="size-3" />
                  </span>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => (it.contact_id ? openContact(it.contact_id) : it.company_id ? navigate(`/entreprises/${it.company_id}`) : null)}
                  >
                    <span className="block truncate text-[12.5px] text-ink">{it.subject || labelOf(INTERACTION_TYPES, it.type)}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {[it.contact_name, it.company_name].filter(Boolean).join(' · ')} · {fmtAgo(it.date)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {isEmpty && (
        <p className="text-center text-[12px] text-ink-3">
          <FolderOpen className="mr-1 inline size-3.5" />
          Astuce : <kbd className="rounded border border-line px-1 text-[11px]">Ctrl K</kbd> pour tout retrouver ou créer rapidement.
        </p>
      )}
    </>
  );
}
