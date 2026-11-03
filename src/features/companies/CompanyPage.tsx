import { ArrowLeft, ExternalLink, Globe, MapPin, MoreHorizontal, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { COMPANY_KINDS, COMPANY_STATUSES, CONTACT_STATUSES, JOB_STATUSES, labelOf } from '../../../shared/constants';
import type { Project } from '../../../shared/types';
import { LinkedinIcon, PriorityIcon, PrioritySelect, ScoreBadge, StatusBadge, StatusSelect } from '../../components/badges';
import { Button, buttonClass, IconButton } from '../../components/ui/button';
import { Menu, useConfirm } from '../../components/ui/overlay';
import { Avatar, Card, EmptyState, Loading, Tabs } from '../../components/ui/misc';
import { useItem, useList, useRemove, useSave } from '../../lib/api';
import { ensureUrl, fmtDate, fmtRelativeDay, fullName, hostname, daysFromToday } from '../../lib/format';
import { useContactSheet, useLocalState } from '../../lib/hooks';
import { ContactForm } from '../contacts/ContactForm';
import { Timeline } from '../interactions/Timeline';
import { InterviewList } from '../interviews/InterviewList';
import { JobForm } from '../jobs/JobForm';
import { EventList } from '../networking/EventList';
import { CompanyForm } from './CompanyForm';
import { ProjectCard } from './ProjectCard';
import { ProjectForm } from './ProjectForm';

type TabKey = 'projets' | 'contacts' | 'offres' | 'entretiens' | 'evenements' | 'journal';

export function CompanyPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: company, isLoading } = useItem('companies', id);
  const { data: projects = [] } = useList('projects', { company_id: id });
  const { data: contacts = [] } = useList('contacts', { company_id: id });
  const { data: jobs = [] } = useList('jobs', { company_id: id });
  const { data: interviews = [] } = useList('interviews', { company_id: id });
  const { data: interactions = [] } = useList('interactions', { company_id: id });
  const { data: events = [] } = useList('events', { organizer_id: id });
  const { data: criteria = [] } = useList('criteria');
  const save = useSave('companies');
  const saveContact = useSave('contacts');
  const saveJob = useSave('jobs');
  const remove = useRemove('companies');
  const { open: openContact } = useContactSheet();

  const [tab, setTab] = useLocalState<TabKey>('company.tab', 'projets');
  const [editOpen, setEditOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);

  if (isLoading) return <Loading />;
  if (!company)
    return (
      <EmptyState
        title="Entreprise introuvable"
        action={
          <Button onClick={() => navigate('/entreprises')} icon={<ArrowLeft />}>
            Retour aux entreprises
          </Button>
        }
      />
    );

  const patch = (data: Record<string, unknown>) => save.mutate({ id: company.id, ...data });

  const del = async () => {
    const ok = await confirm({
      title: `Supprimer ${company.name} ?`,
      message: 'Ses projets seront supprimés. Les contacts, offres et échanges sont conservés mais détachés de l’entreprise.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await remove.mutateAsync(company.id);
    toast.success('Entreprise supprimée');
    navigate('/entreprises');
  };

  return (
    <>
      <Link to="/entreprises" className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> Entreprises
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.015em] text-ink">{company.name}</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">
            {[company.kind && company.kind !== 'entreprise' ? labelOf(COMPANY_KINDS, company.kind) : '', company.sector, company.size].filter(Boolean).join(' · ') ||
              'Secteur non renseigné'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusSelect options={COMPANY_STATUSES} value={company.status} onChange={(v) => patch({ status: v })} />
            <PrioritySelect value={company.priority} onChange={(v) => patch({ priority: v })} />
            {company.member && (
              <span className="inline-flex h-[30px] items-center rounded-md border border-coral/40 bg-coral-soft px-2.5 text-[12.5px] font-medium text-ink">
                J'en fais partie{company.my_role && ` · ${company.my_role}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {company.website && (
            <a href={ensureUrl(company.website)} target="_blank" rel="noreferrer" className={buttonClass()}>
              <Globe /> Site
            </a>
          )}
          {company.linkedin && (
            <a href={ensureUrl(company.linkedin)} target="_blank" rel="noreferrer" className={buttonClass()}>
              <LinkedinIcon /> LinkedIn
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
            items={[{ label: "Supprimer l'entreprise", icon: <Trash2 />, danger: true, onSelect: del }]}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Tabs<TabKey>
            className="mb-5"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'projets', label: 'Projets', count: projects.length },
              { key: 'contacts', label: 'Contacts', count: contacts.length },
              { key: 'offres', label: 'Offres', count: jobs.length },
              { key: 'entretiens', label: 'Entretiens', count: interviews.length },
              { key: 'evenements', label: 'Événements', count: events.length },
              { key: 'journal', label: 'Journal', count: interactions.length },
            ]}
          />

          {tab === 'projets' && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12.5px] text-ink-3">Ce que l'entreprise fait ou va faire, noté selon vos critères.</p>
                <Button size="sm" icon={<Plus />} onClick={() => setProjectForm({ open: true, project: null })}>
                  Nouveau projet
                </Button>
              </div>
              {projects.length === 0 ? (
                <EmptyState
                  compact
                  title="Aucun projet"
                  description="Ajoutez une fiche par projet repéré (actualité, annonce, rapport annuel…) et notez-le selon vos critères."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} criteria={criteria} onOpen={() => setProjectForm({ open: true, project: p })} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'contacts' && (
            <>
              <div className="mb-3 flex justify-end">
                <Button size="sm" icon={<UserPlus />} onClick={() => setContactFormOpen(true)}>
                  Ajouter un contact
                </Button>
              </div>
              {contacts.length === 0 ? (
                <EmptyState compact title="Aucun contact" description="Ajoutez les personnes à contacter dans cette entreprise." />
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                  {contacts.map((c) => {
                    const overdue = c.next_followup && daysFromToday(c.next_followup) <= 0;
                    return (
                      <li
                        key={c.id}
                        onClick={() => openContact(c.id)}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70"
                      >
                        <Avatar name={fullName(c)} className="size-8" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium text-ink">{fullName(c)}</span>
                            <PriorityIcon value={c.priority} />
                          </div>
                          <div className="truncate text-[12px] text-ink-3">
                            {(c.company_id === id ? c.role : c.affiliations?.find((a) => a.company_id === id)?.role) || c.email.split('\n')[0] || '—'}
                            {c.company_id !== id && c.company_name && <span> · {c.company_name}</span>}
                          </div>
                        </div>
                        {c.next_followup && (
                          <span className={overdue ? 'text-[12px] font-medium text-danger' : 'text-[12px] text-ink-3'}>
                            Relance {fmtRelativeDay(c.next_followup)}
                          </span>
                        )}
                        <StatusSelect
                          size="sm"
                          options={CONTACT_STATUSES}
                          value={c.status}
                          onChange={(v) => saveContact.mutate({ id: c.id, status: v })}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {tab === 'offres' && (
            <>
              <div className="mb-3 flex justify-end">
                <Button size="sm" icon={<Plus />} onClick={() => setJobFormOpen(true)}>
                  Ajouter une offre
                </Button>
              </div>
              {jobs.length === 0 ? (
                <EmptyState compact title="Aucune offre" description="Ajoutez les annonces repérées chez cette entreprise." />
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                  {jobs.map((j) => (
                    <li
                      key={j.id}
                      onClick={() => navigate(`/offres/${j.id}`)}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70"
                    >
                      <PriorityIcon value={j.priority} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-ink">{j.title}</div>
                        <div className="truncate text-[12px] text-ink-3">
                          {[j.location, j.contract, j.deadline && `limite ${fmtDate(j.deadline)}`].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      {j.url && (
                        <a
                          href={ensureUrl(j.url)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded p-1 text-ink-3 hover:text-accent-ink"
                          aria-label="Voir l'annonce"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      <StatusSelect size="sm" options={JOB_STATUSES} value={j.status} onChange={(v) => saveJob.mutate({ id: j.id, status: v })} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'entretiens' && <InterviewList filter={{ company_id: id }} showCompany={false} />}
          {tab === 'evenements' && <EventList organizerId={id} />}
          {tab === 'journal' && <Timeline filter={{ company_id: id }} />}
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-3 text-[13px] font-semibold text-ink">En bref</h2>
            {company.description ? (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{company.description}</p>
            ) : (
              <button onClick={() => setEditOpen(true)} className="text-[13px] text-ink-3 hover:text-ink-2">
                Ajouter une description…
              </button>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[12.5px] text-ink-3">Meilleur projet</span>
              <ScoreBadge score={company.best_score} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[12.5px] text-ink-3">Statut</span>
              <StatusBadge options={COMPANY_STATUSES} value={company.status} />
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-ink">Localisations</h2>
              <button onClick={() => setEditOpen(true)} className="text-[12px] text-ink-3 hover:text-ink">
                Modifier
              </button>
            </div>
            {company.locations?.length ? (
              <ul className="space-y-2.5">
                {company.locations.map((l, i) => {
                  const query = [l.address, l.city].filter(Boolean).join(', ') || l.label;
                  return (
                    <li key={i} className="flex gap-2.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                      <div className="min-w-0 text-[13px]">
                        <div className="font-medium text-ink">
                          {l.label || l.city}
                          {l.label && l.city && <span className="font-normal text-ink-3"> · {l.city}</span>}
                        </div>
                        {l.address && <div className="text-[12px] text-ink-3">{l.address}</div>}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.name} ${query}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-accent-ink hover:underline"
                        >
                          Voir sur la carte
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">Aucune localisation.</p>
            )}
          </Card>

          {(company.website || company.linkedin || company.notes) && (
            <Card>
              <h2 className="mb-2 text-[13px] font-semibold text-ink">Liens & notes</h2>
              <div className="space-y-1.5 text-[13px]">
                {company.website && (
                  <a href={ensureUrl(company.website)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-ink-2 hover:text-accent-ink">
                    <Globe className="size-3.5 text-ink-3" /> {hostname(company.website)}
                  </a>
                )}
                {company.linkedin && (
                  <a href={ensureUrl(company.linkedin)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-ink-2 hover:text-accent-ink">
                    <LinkedinIcon className="size-3.5 text-ink-3" /> Page LinkedIn
                  </a>
                )}
              </div>
              {company.notes && <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{company.notes}</p>}
            </Card>
          )}
        </aside>
      </div>

      <CompanyForm open={editOpen} onOpenChange={setEditOpen} company={company} />
      <ProjectForm
        open={projectForm.open}
        onOpenChange={(o) => setProjectForm((s) => ({ ...s, open: o }))}
        companyId={company.id}
        project={projectForm.project}
      />
      <ContactForm open={contactFormOpen} onOpenChange={setContactFormOpen} companyId={company.id} onSaved={(c) => openContact(c.id)} />
      <JobForm open={jobFormOpen} onOpenChange={setJobFormOpen} companyId={company.id} />
    </>
  );
}
