import { ArrowLeft, Building2, ExternalLink, MoreHorizontal, Pencil, Trash2, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { JOB_STATUSES, REMOTE_MODES, labelOf } from '../../../shared/constants';
import { PrioritySelect, StatusSelect } from '../../components/badges';
import { Button, buttonClass, IconButton } from '../../components/ui/button';
import { Textarea } from '../../components/ui/form';
import { Menu, useConfirm } from '../../components/ui/overlay';
import { Card, CardHeader, EmptyState, InfoRow, Loading } from '../../components/ui/misc';
import { useItem, useRemove, useSave } from '../../lib/api';
import { daysFromToday, ensureUrl, fmtDate, fmtRelativeDay, hostname } from '../../lib/format';
import { useContactSheet } from '../../lib/hooks';
import { Timeline } from '../interactions/Timeline';
import { InterviewList } from '../interviews/InterviewList';
import { JobDocuments } from './JobDocuments';
import { JobForm } from './JobForm';

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 1200;
  return (
    <div>
      <div className={long && !expanded ? 'relative max-h-[420px] overflow-hidden' : undefined}>
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2">{text}</p>
        {long && !expanded && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" />}
      </div>
      {long && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-2 text-[12.5px] font-medium text-accent-ink hover:underline">
          {expanded ? 'Réduire' : "Lire toute l'annonce"}
        </button>
      )}
    </div>
  );
}

function NotesCard({ id, notes }: { id: number; notes: string }) {
  const save = useSave('jobs');
  const [value, setValue] = useState(notes);
  useEffect(() => setValue(notes), [notes]);
  return (
    <Card>
      <CardHeader title="Mes notes" subtitle="Enregistrées automatiquement en quittant le champ." />
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== notes && save.mutate({ id, notes: value }, { onSuccess: () => toast.success('Notes enregistrées') })}
        rows={4}
        placeholder="Points forts, doutes, questions à poser, arguments…"
      />
    </Card>
  );
}

export function JobPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: job, isLoading } = useItem('jobs', id);
  const save = useSave('jobs');
  const remove = useRemove('jobs');
  const { open: openContact } = useContactSheet();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <Loading />;
  if (!job)
    return (
      <EmptyState
        title="Offre introuvable"
        action={
          <Button onClick={() => navigate('/offres')} icon={<ArrowLeft />}>
            Retour aux offres
          </Button>
        }
      />
    );

  const del = async () => {
    if (!(await confirm({ title: 'Supprimer cette offre ?', message: `« ${job.title} » sera supprimée. Les entretiens et échanges liés sont conservés.`, confirmLabel: 'Supprimer', danger: true })))
      return;
    await remove.mutateAsync(job.id);
    toast.success('Offre supprimée');
    navigate('/offres');
  };

  const deadlineDays = job.deadline ? daysFromToday(job.deadline) : null;

  return (
    <>
      <Link to="/offres" className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> Offres
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.015em] text-ink">{job.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13.5px] text-ink-3">
            {job.company_id ? (
              <Link to={`/entreprises/${job.company_id}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-accent-ink hover:underline">
                <Building2 className="size-3.5" /> {job.company_name}
              </Link>
            ) : (
              <span>Entreprise non renseignée</span>
            )}
            {[job.location, job.contract, job.remote && labelOf(REMOTE_MODES, job.remote)].filter(Boolean).map((x) => (
              <span key={x}>· {x}</span>
            ))}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusSelect options={JOB_STATUSES} value={job.status} onChange={(v) => save.mutate({ id: job.id, status: v })} />
            <PrioritySelect value={job.priority} onChange={(v) => save.mutate({ id: job.id, priority: v })} />
            {deadlineDays != null && ['a_etudier', 'a_postuler'].includes(job.status) && (
              <span className={deadlineDays <= 3 ? 'text-[12.5px] font-medium text-danger' : 'text-[12.5px] text-ink-2'}>
                Date limite {fmtRelativeDay(job.deadline)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.url && (
            <a href={ensureUrl(job.url)} target="_blank" rel="noreferrer" className={buttonClass('primary')}>
              <ExternalLink /> Voir l'annonce
            </a>
          )}
          <Button icon={<Pencil />} onClick={() => setEditOpen(true)}>
            Modifier
          </Button>
          <Menu
            trigger={
              <IconButton label="Plus d'actions" variant="secondary" size="md">
                <MoreHorizontal />
              </IconButton>
            }
            items={[{ label: "Supprimer l'offre", icon: <Trash2 />, danger: true, onSelect: del }]}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Annonce" subtitle={job.url ? hostname(job.url) : undefined} />
            {job.description ? (
              <Description text={job.description} />
            ) : (
              <button onClick={() => setEditOpen(true)} className="text-[13px] text-ink-3 hover:text-ink-2">
                Collez le texte de l'annonce pour le garder même si elle est retirée…
              </button>
            )}
          </Card>
          <NotesCard id={job.id} notes={job.notes} />
          <Card>
            <CardHeader title="Entretiens" />
            <InterviewList filter={{ job_id: job.id }} defaults={{ company_id: job.company_id, contact_id: job.contact_id }} showCompany={false} />
          </Card>
          <Card>
            <CardHeader title="Journal" />
            <Timeline filter={{ job_id: job.id }} defaults={{ contact_id: job.contact_id, company_id: job.company_id }} />
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-1 text-[13px] font-semibold text-ink">Détails</h2>
            <dl className="divide-y divide-line">
              <InfoRow label="Rémunération">{job.salary || '—'}</InfoRow>
              <InfoRow label="Contrat">{job.contract || '—'}</InfoRow>
              <InfoRow label="Télétravail">{job.remote ? labelOf(REMOTE_MODES, job.remote) : '—'}</InfoRow>
              <InfoRow label="Lieu">{job.location || '—'}</InfoRow>
              <InfoRow label="Date limite">{job.deadline ? fmtDate(job.deadline, { year: true }) : '—'}</InfoRow>
              <InfoRow label="Postulé le">{job.applied_at ? fmtDate(job.applied_at, { year: true }) : '—'}</InfoRow>
              <InfoRow label="Ajoutée le">{fmtDate(job.created_at, { year: true })}</InfoRow>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 text-[13px] font-semibold text-ink">Contact référent</h2>
            {job.contact_id && job.contact_name ? (
              <button
                onClick={() => openContact(job.contact_id!)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-left text-[13px] hover:border-line-strong"
              >
                <UserRound className="size-4 text-ink-3" />
                <span className="flex-1 truncate font-medium text-ink">{job.contact_name}</span>
              </button>
            ) : (
              <button onClick={() => setEditOpen(true)} className="text-[13px] text-ink-3 hover:text-ink-2">
                Associer un contact…
              </button>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 text-[13px] font-semibold text-ink">Documents de candidature</h2>
            <JobDocuments job={job} />
          </Card>
        </aside>
      </div>

      <JobForm open={editOpen} onOpenChange={setEditOpen} job={job} />
    </>
  );
}
