# Trajectoire · dashboard de recherche d'emploi

Web app pour piloter une recherche d'emploi : entreprises et projets notés selon vos critères, contacts et
relances, offres et candidatures, entretiens, modèles de mails, et vos documents (CV LaTeX, lettres de
motivation) éditables dans le navigateur.

**Aucun serveur** : l'app est publiée sur GitHub Pages et tout tourne dans le navigateur (base SQLite en
WebAssembly, enregistrée localement, utilisable hors ligne). Vos données et vos documents sont synchronisés
dans **un dépôt GitHub privé** à vous. Ce dépôt-ci ne contient que le code, jamais vos données.

## Fonctionnalités

| Module | Ce qu'on y fait |
|---|---|
| Vue d'ensemble | Tâches du jour (relances, entretiens, échéances, priorités), indicateurs, activité, entonnoir |
| Pipeline | Kanban glisser-déposer des candidatures et des contacts par statut |
| Entreprises | Fiche entreprise, localisations, fiches projet notées (critères pondérés), contacts, offres, journal |
| Contacts | Poste, email, téléphone, LinkedIn, avancement, priorité, prochaine relance, journal des échanges |
| Offres | Lien et texte de l'annonce, statut, documents envoyés, lettre générée depuis un modèle |
| Entretiens | Planning, préparation, compte rendu, retour |
| Modèles de mails | Variables `{{prenom}}`, `{{entreprise}}`, `{{poste}}`… ; envoi via Gmail, Outlook ou la messagerie par défaut, puis journalisation |
| Documents | Arborescence, visionneuse (PDF, images, Word), éditeur LaTeX avec aperçu PDF, éditeur de lettres A4 avec export PDF / Word |

Raccourcis : `Ctrl K` recherche et création rapide, `Ctrl S` enregistre dans les éditeurs, `Ctrl Entrée` valide les formulaires.

## Installer l'app sur l'ordinateur (barre des tâches)

1. Ouvrez l'app dans **Chrome** (ou Edge) : `https://<votre-compte>.github.io/trajectoire/`.
2. Cliquez sur **Installer l'app** en bas de la barre latérale (ou sur l'icône d'installation dans la barre d'adresse).
   Elle s'ouvre dans sa propre fenêtre.
3. Clic droit sur son icône dans la barre des tâches → **Épingler à la barre des tâches**.

Firefox ne sait pas installer de web app : utilisez Chrome ou Edge pour la fenêtre, le reste de votre navigation ne change pas.
Clic droit sur l'icône épinglée : raccourcis directs vers Pipeline, Contacts, Offres et Documents.

### Sur l'iPhone

Ouvrez l'adresse de l'app dans Safari → **Partager** → **Sur l'écran d'accueil**. L'app s'ouvre alors en plein écran,
avec une barre d'onglets en bas, et fonctionne hors ligne. Pour la connecter sans retaper le jeton : sur l'ordinateur,
**Paramètres → Sur votre iPhone → Afficher le code de connexion** ; sur l'iPhone, **Plus → Paramètres → Scanner le
code**. L'app installée a ses propres données, séparées de Safari : connectez-la depuis son icône.

## Synchroniser avec GitHub (données + documents)

Sans connexion, tout reste dans le navigateur de cet appareil. Pour sauvegarder, retrouver vos données sur un
autre appareil et utiliser le module Documents :

1. Créez un dépôt **privé**, par exemple `trajectoire-donnees`. Le modèle de son contenu est dans
   [`repo-template/`](repo-template/), dont le workflow de compilation LaTeX.
2. Créez un [jeton « fine-grained »](https://github.com/settings/personal-access-tokens/new) limité à ce seul
   dépôt, avec **Contents : Read and write** et **Actions : Read and write** (relancer une compilation).
3. Dans l'app : **Paramètres → Synchronisation GitHub**, renseignez le compte, le dépôt et le jeton.

La synchro se fait à l'ouverture, au retour sur la fenêtre et quelques secondes après chaque modification.
Chaque élément porte sa date de modification : la version la plus récente l'emporte, et les suppressions se
propagent. Le jeton reste dans le navigateur et n'est jamais synchronisé. L'app refuse un dépôt public.

Le dépôt privé contient `trajectoire.json` (vos données, à ne pas modifier à la main) et `documents/` (vos
fichiers). Vous profitez de l'historique Git de chaque version.

### Compilation LaTeX

« Compiler » (ou `Ctrl S`) enregistre le `.tex` dans le dépôt privé. Un workflow GitHub Actions le compile avec
[Tectonic](https://tectonic-typesetting.github.io/) et dépose le PDF à côté. Comptez 30 à 60 secondes ; l'éditeur
affiche la progression puis l'aperçu, ou le journal d'erreurs. Votre CV ne quitte pas votre compte GitHub.

### Calendrier Apple (iCloud)

Une minute après une synchro qui modifie un événement de networking, un entretien, une relance ou un message /
call prévu, l'app lance le workflow `calendrier.yml` du dépôt privé (à activer dans **Paramètres → Calendrier Apple**, qui détaille la mise en place). Il met à jour un calendrier iCloud
« Trajectoire » par CalDAV : création, modification et suppression, sans toucher aux autres événements. Il faut
deux secrets dans le dépôt privé : `ICLOUD_USER` (Apple ID) et `ICLOUD_APP_PASSWORD` (mot de passe
d'application). Le passage par GitHub est nécessaire : une page web ne peut pas appeler iCloud directement (CORS).

## Sauvegardes

- Données : dans le navigateur et, si GitHub est connecté, dans le dépôt privé avec tout l'historique.
- Paramètres → **Exporter (JSON)** télécharge toutes les données ; **Restaurer…** les recharge.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build dans dist/
npm run preview    # sert la version compilée
```

À chaque push sur `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publie l'app sur
GitHub Pages (réglage du dépôt : *Settings → Pages → Source : GitHub Actions*).

Pile : React 19, React Router, TanStack Query, Tailwind CSS 4, Radix UI, dnd-kit, TipTap, CodeMirror ·
Hono + Zod + SQLite WASM exécutés dans le navigateur (`src/backend/`) · API GitHub pour la synchro (`src/lib/github.ts`).

Organisation : `src/backend/` (API embarquée, base, synchro), `shared/` (statuts, types, calcul du score),
`src/features/` (une page par dossier), `src/components/` (composants communs). Les listes de statuts se
modifient dans `shared/constants.ts`.
