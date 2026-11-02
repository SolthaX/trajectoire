// Listes de valeurs partagées entre le serveur et l'interface.
// Pour ajouter / renommer un statut, c'est ici que ça se passe.

/** Clés de couleur (définies en CSS : var(--c-<clé>)). */
export type ColorKey = 'gray' | 'slate' | 'amber' | 'orange' | 'blue' | 'violet' | 'green' | 'red';

export interface Option<V extends string = string> {
  value: V;
  label: string;
  color?: ColorKey;
}

function opts<const T extends readonly Option[]>(list: T) {
  return list;
}

export const PRIORITIES = opts([
  { value: 'haute', label: 'Haute', color: 'red' },
  { value: 'moyenne', label: 'Moyenne', color: 'amber' },
  { value: 'basse', label: 'Basse', color: 'gray' },
] as const);

export const COMPANY_STATUSES = opts([
  { value: 'a_explorer', label: 'À explorer', color: 'gray' },
  { value: 'cible', label: 'Cible', color: 'blue' },
  { value: 'en_discussion', label: 'En discussion', color: 'violet' },
  { value: 'ecartee', label: 'Écartée', color: 'slate' },
] as const);

export const PROJECT_STATUSES = opts([
  { value: 'a_venir', label: 'À venir', color: 'amber' },
  { value: 'en_cours', label: 'En cours', color: 'blue' },
  { value: 'termine', label: 'Terminé', color: 'slate' },
] as const);

export const CONTACT_STATUSES = opts([
  { value: 'non_contacte', label: 'Non contacté', color: 'gray' },
  { value: 'contacte', label: 'Contacté · en attente', color: 'amber' },
  { value: 'relance', label: 'Relancé · en attente', color: 'orange' },
  { value: 'en_contact', label: 'En contact', color: 'blue' },
  { value: 'rdv', label: 'RDV / entretien', color: 'violet' },
  { value: 'sans_suite', label: 'Sans suite', color: 'slate' },
] as const);

export const JOB_STATUSES = opts([
  { value: 'a_etudier', label: 'À étudier', color: 'gray' },
  { value: 'a_postuler', label: 'À postuler', color: 'amber' },
  { value: 'postule', label: 'Postulé', color: 'blue' },
  { value: 'entretien', label: 'Entretiens', color: 'violet' },
  { value: 'offre', label: 'Offre', color: 'green' },
  { value: 'refuse', label: 'Refusé', color: 'red' },
  { value: 'abandonne', label: 'Abandonné', color: 'slate' },
] as const);

export const CONTRACTS = opts([
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Portage', label: 'Portage' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Alternance', label: 'Alternance' },
  { value: 'Intérim', label: 'Intérim' },
  { value: 'Autre', label: 'Autre' },
] as const);

export const REMOTE_MODES = opts([
  { value: 'sur_site', label: 'Sur site' },
  { value: 'hybride', label: 'Hybride' },
  { value: 'teletravail', label: 'Télétravail' },
] as const);

export const INTERVIEW_KINDS = opts([
  { value: 'rh', label: 'RH' },
  { value: 'manager', label: 'Manager' },
  { value: 'technique', label: 'Technique / cas' },
  { value: 'equipe', label: 'Équipe' },
  { value: 'final', label: 'Final / direction' },
  { value: 'autre', label: 'Autre' },
] as const);

export const INTERVIEW_FORMATS = opts([
  { value: 'visio', label: 'Visio' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'sur_site', label: 'Sur site' },
] as const);

export const INTERVIEW_STATUSES = opts([
  { value: 'prevu', label: 'Prévu', color: 'blue' },
  { value: 'passe', label: 'Passé', color: 'slate' },
  { value: 'annule', label: 'Annulé', color: 'gray' },
] as const);

export const INTERVIEW_OUTCOMES = opts([
  { value: 'en_attente', label: 'Retour en attente', color: 'amber' },
  { value: 'positif', label: 'Positif', color: 'green' },
  { value: 'negatif', label: 'Négatif', color: 'red' },
] as const);

export const INTERACTION_TYPES = opts([
  { value: 'email', label: 'Email' },
  { value: 'appel', label: 'Appel' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'rdv', label: 'Rendez-vous' },
  { value: 'candidature', label: 'Candidature' },
  { value: 'note', label: 'Note' },
] as const);

export const INTERACTION_DIRECTIONS = opts([
  { value: 'sortant', label: 'Envoyé / à mon initiative' },
  { value: 'entrant', label: 'Reçu / à leur initiative' },
  { value: 'prevu', label: 'À faire (prévu)' },
] as const);

export const TEMPLATE_CATEGORIES = opts([
  { value: 'premier_contact', label: 'Premier contact' },
  { value: 'candidature', label: 'Candidature' },
  { value: 'relance', label: 'Relance' },
  { value: 'remerciement', label: 'Remerciement' },
  { value: 'autre', label: 'Autre' },
] as const);

export const CIVILITIES = opts([
  { value: '', label: '—' },
  { value: 'M.', label: 'M.' },
  { value: 'Mme', label: 'Mme' },
] as const);

/** Statuts de contact considérés comme « déjà contacté ». */
export const CONTACTED_STATUSES = ['contacte', 'relance', 'en_contact', 'rdv', 'sans_suite'] as const;
/** Statuts de contact considérés comme « a répondu ». */
export const RESPONDED_STATUSES = ['en_contact', 'rdv'] as const;
/** Statuts d'offre considérés comme « candidature envoyée ». */
export const APPLIED_STATUSES = ['postule', 'entretien', 'offre', 'refuse'] as const;
/** Statuts terminés (exclus des listes « à faire »). */
export const CLOSED_CONTACT_STATUSES = ['sans_suite'] as const;
export const CLOSED_JOB_STATUSES = ['offre', 'refuse', 'abandonne'] as const;

/** Variables utilisables dans les modèles de mails et les lettres. */
export const TEMPLATE_VARIABLES = [
  { key: 'civilite', label: 'Civilité (Madame / Monsieur)', group: 'Contact' },
  { key: 'prenom', label: 'Prénom du contact', group: 'Contact' },
  { key: 'nom', label: 'Nom du contact', group: 'Contact' },
  { key: 'poste_contact', label: 'Poste du contact', group: 'Contact' },
  { key: 'entreprise', label: 'Entreprise', group: 'Entreprise' },
  { key: 'projet', label: 'Projet choisi', group: 'Entreprise' },
  { key: 'poste', label: "Intitulé de l'offre", group: 'Offre' },
  { key: 'lien_offre', label: "Lien de l'offre", group: 'Offre' },
  { key: 'mon_prenom', label: 'Mon prénom', group: 'Moi' },
  { key: 'mon_nom', label: 'Mon nom', group: 'Moi' },
  { key: 'mon_email', label: 'Mon email', group: 'Moi' },
  { key: 'mon_telephone', label: 'Mon téléphone', group: 'Moi' },
  { key: 'mon_linkedin', label: 'Mon LinkedIn', group: 'Moi' },
  { key: 'signature', label: 'Ma signature', group: 'Moi' },
  { key: 'date', label: "Date du jour", group: 'Divers' },
] as const;

export function optionOf<T extends readonly Option[]>(list: T, value: string | null | undefined): T[number] | undefined {
  return list.find((o) => o.value === value);
}

export function labelOf(list: readonly Option[], value: string | null | undefined): string {
  return list.find((o) => o.value === value)?.label ?? (value || '—');
}
