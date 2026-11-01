// Données créées au tout premier lancement (modifiables ensuite dans l'app).

export const DEFAULT_CRITERIA = [
  { name: 'Intérêt du projet', description: 'Le sujet me motive-t-il vraiment ?', weight: 2 },
  { name: 'Adéquation à mon profil', description: 'Mes compétences et mon expérience correspondent-elles ?', weight: 2 },
  { name: "Perspectives d'évolution", description: 'Montée en compétences, responsabilités, visibilité.', weight: 1.5 },
  { name: 'Rémunération & conditions', description: 'Salaire, avantages, télétravail.', weight: 1 },
  { name: 'Localisation / trajet', description: 'Temps de trajet, ville, déplacements.', weight: 1 },
  { name: 'Culture & équipe', description: 'Ambiance, valeurs, management.', weight: 1 },
];

export const DEFAULT_TEMPLATES = [
  {
    name: 'Approche réseau · premier contact',
    category: 'premier_contact',
    subject: '{{entreprise}} · échange autour de {{projet}}',
    body: `Bonjour {{prenom}},

Je me permets de vous contacter car je m'intéresse de près à {{entreprise}}, et en particulier au projet {{projet}}.

[Une ou deux phrases : ce qui vous attire dans ce projet et le lien avec votre parcours.]

Seriez-vous disponible pour un court échange de 15 à 20 minutes dans les prochains jours ? Ce serait un plaisir d'en apprendre davantage sur vos enjeux et sur l'équipe.

Je vous remercie par avance et vous souhaite une belle journée.

{{signature}}`,
  },
  {
    name: 'Candidature à une offre',
    category: 'candidature',
    subject: 'Candidature · {{poste}}',
    body: `Bonjour {{civilite}} {{nom}},

Je vous adresse ma candidature pour le poste de {{poste}} au sein de {{entreprise}}.

[Deux ou trois phrases : ce que vous apportez, une réalisation chiffrée, pourquoi cette entreprise.]

Vous trouverez ci-joint mon CV et ma lettre de motivation. Je reste à votre disposition pour un entretien.

Bien cordialement,

{{signature}}`,
  },
  {
    name: 'Candidature spontanée',
    category: 'candidature',
    subject: 'Candidature spontanée · {{mon_prenom}} {{mon_nom}}',
    body: `Bonjour {{prenom}},

Je suis avec attention les activités de {{entreprise}}, notamment {{projet}}, et je souhaiterais vous proposer ma candidature.

[Votre proposition de valeur en deux phrases.]

Je serais heureux·se d'échanger avec vous sur les besoins de vos équipes. Vous trouverez mon CV en pièce jointe.

Bien cordialement,

{{signature}}`,
  },
  {
    name: 'Relance après un premier message',
    category: 'relance',
    subject: 'Re : {{entreprise}} · suite à mon message',
    body: `Bonjour {{prenom}},

Je me permets de revenir vers vous suite à mon précédent message. Je reste très intéressé·e par {{entreprise}} et serais ravi·e d'en discuter quand cela vous conviendra.

Belle journée,

{{signature}}`,
  },
  {
    name: 'Remerciement après entretien',
    category: 'remerciement',
    subject: 'Merci pour notre échange · {{poste}}',
    body: `Bonjour {{prenom}},

Merci pour le temps que vous m'avez accordé aujourd'hui. Notre échange a renforcé mon envie de rejoindre {{entreprise}}.

[Rappel d'un point clé de l'entretien et de ce que vous pouvez y apporter.]

Je reste à votre disposition pour toute information complémentaire.

Bien cordialement,

{{signature}}`,
  },
];
