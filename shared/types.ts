// Types des entités renvoyées par l'API.

export interface Location {
  label: string; // ex. « Siège », « Agence Lyon »
  city: string;
  address: string;
}

export interface Company {
  id: number;
  name: string;
  sector: string;
  website: string;
  linkedin: string;
  size: string;
  description: string;
  notes: string;
  status: string;
  priority: string;
  locations: Location[];
  /** entreprise / reseau / ecole (voir COMPANY_KINDS). */
  kind: string;
  /** « Mes réseaux » : j'en fais partie. */
  member: boolean;
  my_role: string;
  created_at: string;
  updated_at: string;
  // calculés
  contacts_count?: number;
  events_count?: number;
  jobs_count?: number;
  projects_count?: number;
  last_activity?: string | null;
  best_score?: number | null;
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  id: number;
  company_id: number;
  name: string;
  status: string;
  summary: string;
  details: string;
  links: ProjectLink[];
  start_date: string | null;
  end_date: string | null;
  scores: Record<string, number | null>;
  notes: string;
  created_at: string;
  updated_at: string;
  company_name?: string;
  score?: number | null;
}

export interface Contact {
  id: number;
  company_id: number | null;
  civility: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  status: string;
  priority: string;
  next_followup: string | null;
  source: string;
  notes: string;
  /** Entreprises en plus de l'entreprise principale (company_id / role). */
  affiliations: Affiliation[];
  created_at: string;
  updated_at: string;
  company_name?: string | null;
  last_interaction?: string | null;
  /** Événements où la personne a été rencontrée (calculé). */
  met_at?: { id: number; name: string; starts_at: string }[];
}

export interface Affiliation {
  company_id: number;
  role: string;
  company_name?: string;
}

export interface Attendee {
  contact_id: number;
  note: string;
  contact_name?: string;
  contact_sub?: string;
}

export interface NetworkEvent {
  id: number;
  organizer_id: number | null;
  name: string;
  kind: string;
  starts_at: string;
  ends_at: string | null;
  place: string;
  /** Lien de visio. */
  link: string;
  /** Page de l'événement / inscription. */
  url: string;
  status: string;
  preparation: string;
  debrief: string;
  next_steps: string;
  attendees: Attendee[];
  created_at: string;
  updated_at: string;
  organizer_name?: string | null;
}

export interface Job {
  id: number;
  company_id: number | null;
  contact_id: number | null;
  title: string;
  url: string;
  location: string;
  contract: string;
  remote: string;
  salary: string;
  status: string;
  priority: string;
  deadline: string | null;
  applied_at: string | null;
  description: string;
  notes: string;
  documents: string[];
  created_at: string;
  updated_at: string;
  company_name?: string | null;
  contact_name?: string | null;
}

export interface Interview {
  id: number;
  company_id: number | null;
  job_id: number | null;
  contact_id: number | null;
  scheduled_at: string;
  duration: number | null;
  kind: string;
  format: string;
  place: string;
  interviewers: string;
  status: string;
  outcome: string;
  preparation: string;
  notes: string;
  next_steps: string;
  created_at: string;
  updated_at: string;
  company_name?: string | null;
  job_title?: string | null;
  contact_name?: string | null;
}

export interface Interaction {
  id: number;
  contact_id: number | null;
  company_id: number | null;
  job_id: number | null;
  type: string;
  direction: string;
  date: string;
  subject: string;
  content: string;
  /** Lien de visio (call prévu en visio). */
  link: string;
  created_at: string;
  company_name?: string | null;
  contact_name?: string | null;
  job_title?: string | null;
}

export interface Template {
  id: number;
  name: string;
  category: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Criterion {
  id: number;
  name: string;
  description: string;
  weight: number;
  position: number;
}

export interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  linkedin: string;
  signature: string;
}

export interface Settings {
  profile: Profile;
  followup_days: number;
  /** Moteur de compilation LaTeX : GitHub Actions (défaut) ou service en ligne rapide. */
  latex_engine: 'github' | 'rapide';
}

export interface DashboardData {
  kpis: {
    companies: number;
    contacts_active: number;
    contacted: number;
    responded: number;
    applications: number;
    interviews_upcoming: number;
    offers: number;
  };
  followups: (Contact & { overdue_days: number })[];
  upcoming_interviews: Interview[];
  upcoming_events: NetworkEvent[];
  deadlines: Job[];
  to_apply: Job[];
  to_contact: Contact[];
  weekly: { week: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  contact_statuses: { status: string; count: number }[];
  top_companies: { id: number; name: string; score: number; projects: number }[];
  recent: Interaction[];
  planned: Interaction[];
}

export type CalendarKind = 'evenement' | 'entretien' | 'relance' | 'prevu' | 'echange';

export interface CalendarItem {
  key: string;
  kind: CalendarKind;
  date: string; // AAAA-MM-JJ ou AAAA-MM-JJTHH:MM
  title: string;
  sub: string;
  detail?: string; // type d'entretien ou d'échange
  status?: string;
  contact_id?: number | null;
  company_id?: number | null;
  job_id?: number | null;
  event_id?: number;
}

export interface SearchResult {
  type: 'company' | 'contact' | 'job' | 'event' | 'file';
  id: string;
  title: string;
  subtitle: string;
}

export interface FileNode {
  name: string;
  path: string; // relatif au dossier documents, séparateur « / »
  type: 'file' | 'dir';
  size?: number;
  mtime?: number;
  children?: FileNode[];
}
