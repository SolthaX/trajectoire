# Reprise — Trajectoire (dashboard de recherche d'emploi)

> Dernière mise à jour : 2026-11-04 15:34 · branche `main` · commit `a7e0620` · en ligne : https://solthax.github.io/trajectoire/
> Fichier maintenu par `/end` (lu par `/start`). Aucune donnée sensible ici.

## Indicateurs

| Indicateur | Valeur |
|---|---|
| Objectifs du jalon en cours | 7/8 (88 %) : reste le premier test réel avec le jeton · jalon « usage » : 13/16 |
| Tests | Pas de suite dans le dépôt ; vérifs hors dépôt 2026-11-04 : Playwright (calendrier, émulation iPhone 13, QR aller-retour) + synchro CalDAV contre Radicale local |
| Lint / typecheck | `npm run typecheck` OK · `npm run build` OK |
| Commits (total / depuis la dernière reprise) | 18 / 4 (+1 887 / −63 lignes, 24 fichiers) |
| Modifications non commitées | aucune |

## État actuel

Web app 100 % navigateur, sur le modèle de Benkyō (JapaneseStudy) : destinée à GitHub Pages, installable
depuis Chrome et épinglable à la barre des tâches. L'API Hono + SQLite (WASM) tourne dans la page
(`src/backend/`), les données sont persistées dans IndexedDB et l'app fonctionne hors ligne (service worker).
La synchro (données `trajectoire.json` + `documents/`) passe par un dépôt GitHub **privé**, et la compilation
LaTeX par GitHub Actions (Tectonic). Tout a été testé contre un faux GitHub en mémoire, rien encore sur le vrai.

## Fait lors de la dernière session

- 2026-11-04, tout poussé et déployé (`b7516b9`, `0092cad`, `9103e9c`, `a7e0620`).
- **Liens dans Zen** (`src/lib/zen.ts`) : dans l'app installée, liens externes réécrits en `zen-open:<URL encodée>` ;
  protocole Windows enregistré par `scripts/windows/installer-liens-zen.ps1` (lancé par l'utilisateur, OK).
  Réglage par appareil : Paramètres → Liens externes (Chrome par défaut).
- **Calendrier mensuel** sur le tableau de bord (`src/features/dashboard/CalendarCard.tsx`, route `/calendar`) :
  networking (ciel), entretiens (prune), relances (corail), messages prévus (safran), échanges (sauge) ; légende
  filtrable. Activité et Projets les mieux notés déplacés sous le calendrier.
- **Synchro iCloud** : `repo-template/.github/calendrier/icloud.py` + `workflows/calendrier.yml` (CalDAV, calendrier
  dédié « Trajectoire », UID `trajectoire-*`, empreinte par événement). Installé dans `trajectoire-donnees`
  (`974d80a`, `8f368de`). L'app le déclenche (`src/backend/calendarSync.ts`) 1 min après une synchro qui change le
  calendrier, si `settings.calendar_sync` est activé. Tuto + état du dernier passage dans Paramètres.
- **Version iPhone** : barre d'onglets, zones sûres, méta Apple, pas de zoom sur les champs, bandeau d'installation
  Safari, resynchro sur `visibilitychange` (`useAutoSync`), connexion par QR code (`src/lib/connexion.ts`,
  `src/features/settings/PhoneCard.tsx`, dépendances `qrcode` + `jsqr`).

## En cours

- Synchro iCloud jamais testée sur le vrai iCloud : il manque les secrets `ICLOUD_USER` / `ICLOUD_APP_PASSWORD`
  dans `trajectoire-donnees`, puis Paramètres → Calendrier Apple → Activée → « Mettre à jour maintenant ».
- Version iPhone non testée sur l'appareil (iPhone 15) : Dynamic Island, scan caméra, installation.

- L'utilisateur a 4 contacts réels dans l'app : toute évolution doit préserver les données (instantané compatible).
- Les versions de l'app antérieures à `140db78` n'ont pas le garde de schéma : si l'une d'elles reste ouverte
  sur un appareil synchronisé, elle effacerait les événements et les affiliations. Recharger partout.
- Compilation rapide non testée de bout en bout sur le vrai dépôt (commit PDF, `[skip ci]` respecté).
- Publié par l'utilisateur via `./scripts/publier-github.sh` : Pages déployé, dépôt privé `trajectoire-donnees`
  initialisé, premier passage du workflow LaTeX réussi (1 min 13, PDF commité par le bot).
- Reste : jeton fine-grained, installation dans Chrome, connexion GitHub dans Paramètres.
- 2026-11-02 : l'icône Benkyō épinglée ouvrait Trajectoire. Les deux manifestes avaient `"id": "./"`, que
  Chrome résout depuis la racine du domaine (`https://solthax.github.io/`) : même identité, l'installation de
  Trajectoire a remplacé Benkyō. Corrigé dans les deux dépôts (Trajectoire `fa48fb2`, JapaneseStudy `85a738b`,
  cloné dans `~/projets/JapaneseStudy`) et vérifié dans Chromium (`Page.getAppId`) : deux identités distinctes.
  **À faire par l'utilisateur dans Chrome** : désinstaller l'app actuelle, **sans** cocher « effacer les données »
  (ce qui viderait les données des deux apps), puis réinstaller et réépingler Benkyō et Trajectoire depuis leurs URL.

## Objectifs (jalon : web app publiée et épinglée)

- [x] Backend dans le navigateur + persistance locale + hors ligne
- [x] Synchro GitHub (dépôt privé) testée sur deux appareils simulés
- [x] Documents + compilation LaTeX via GitHub Actions
- [x] Web app installable (manifeste, icônes, service worker)
- [x] Workflow de déploiement GitHub Pages
- [x] README à jour
- [x] Publier : `./scripts/publier-github.sh` (dépôt public `trajectoire` + Pages, dépôt privé `trajectoire-donnees`)
- [ ] Premier vrai test : jeton fine-grained, synchro, compilation du CV d'exemple, aperçu PDF dans Chrome

## Objectifs (jalon : usage quotidien)

- [x] Plusieurs emails / téléphones par contact
- [x] Planifier mails, messages LinkedIn / WhatsApp / SMS et calls (thème, lien visio) + onglet « À envoyer »
- [x] Palette de couleurs personnalisée et étendue
- [x] Compilation LaTeX rapide en option
- [ ] Vérifier la compilation rapide sur le vrai dépôt
- [x] Un contact lié à plusieurs entreprises, avec un rôle par lien
- [x] Type d'entreprise (entreprise / réseau-association / école) : Shift Project Paris, AX, l'X… sont des
      « entreprises » de type réseau
- [x] Onglet Networking : événements (base, statut d'inscription, contacts rencontrés, préparation / bilan)
- [x] Section « Mes réseaux » : mes appartenances et mon rôle (ex. shifter au Shift Project Paris)
- [x] Export des événements vers le calendrier (.ics) pour l'iPhone
- [x] Liens externes ouverts dans Zen depuis l'app installée
- [x] Calendrier mensuel sur le tableau de bord
- [x] Synchro automatique vers un calendrier iCloud (code + tuto)
- [ ] Synchro iCloud vérifiée sur le vrai compte (secrets à ajouter)
- [x] Version iPhone (installable, onglets, connexion par QR code)
- [ ] Version iPhone vérifiée sur l'iPhone 15

## Prochaine étape proposée

Connecter GitHub dans l'app du PC (jeton fine-grained), puis installer l'app sur l'iPhone 15 et la connecter par
QR code. Ensuite : mot de passe d'application Apple + secrets, activer la synchro iCloud, vérifier que le calendrier
« Trajectoire » apparaît sur l'iPhone.

## Décisions prises

- 2026-11-01 : V1 en web app locale (serveur Node), abandonnée le lendemain.
- 2026-11-02 : architecture Benkyō, sur demande : GitHub Pages, pas de serveur, données dans le navigateur.
- 2026-11-02 : dépôt GitHub privé plutôt qu'un gist secret (contacts = données personnelles ; documents ; historique).
- 2026-11-02 : compilation LaTeX par GitHub Actions (le serveur de paquets de SwiftLaTeX ne répond plus, et
  envoyer le CV à un service tiers a été écarté).
- 2026-11-02 : jeton fine-grained limité au dépôt privé, gardé dans le navigateur, jamais synchronisé ;
  l'app refuse un dépôt public.
- 2026-11-01 : statuts définis dans `shared/constants.ts`.
- 2026-11-02 : emails / téléphones multiples dans les colonnes existantes (une valeur par ligne) plutôt qu'une
  nouvelle table : aucune migration, données existantes intactes.
- 2026-11-02 : actions planifiées = interactions de sens `prevu` (pas de table séparée) ; « Fait » les passe en `sortant`.
- 2026-11-02 : compilation via claucloverleaf écartée (MCP local, inaccessible depuis une page web) ; service
  latex.ytotech.com accepté par l'utilisateur **en option**, risques expliqués, GitHub par défaut. Revient sur
  la décision « service tiers écarté » ci-dessus pour ce seul usage optionnel.
- 2026-11-03 : liens contact ↔ entreprises et participants d'événement en colonnes JSON (comme `locations`),
  pas de table de liaison : pas de migration, fusion de synchro ligne à ligne inchangée ; références orphelines
  filtrées à la lecture.
- 2026-11-03 : réseaux et écoles = entreprises typées (`kind`), pas une entité séparée ; « Mes réseaux » = `member`.
- 2026-11-03 : calendrier abonné (webcal) écarté : l'utilisateur refuse de publier un .ics à une adresse
  publique (gist secret), donc l'export se fait uniquement par fichier .ics téléchargé. Synchro CalDAV iCloud
  impossible sans serveur (CORS).
- 2026-11-04 : liens vers Zen par protocole Windows `zen-open:` (une page ne peut pas choisir le navigateur),
  appliqué seulement dans l'app installée.
- 2026-11-04 : synchro Apple Calendar par GitHub Actions → iCloud CalDAV (choix de l'utilisateur) ; revient sur
  « CalDAV iCloud impossible » : impossible depuis la page, possible depuis le runner. Heures flottantes, comme l'export.
- 2026-11-04 : le workflow calendrier n'est pas déclenché à chaque push mais par l'app (empreinte + délai 1 min),
  pour ménager les 2 000 min/mois d'Actions du dépôt privé. Activation synchronisée (`settings.calendar_sync`).
- 2026-11-04 : version iPhone = la même PWA installée depuis Safari (pas d'app native).
- 2026-11-02 : chaque app de `solthax.github.io` a un id de manifeste absolu (`/trajectoire/`, `/JapaneseStudy/`),
  contrôlé au build pour Trajectoire. Sur l'origine partagée, chaque app ne touche qu'à ses propres caches et
  clés (`trajectoire-*` / `trajectoire:*`, `benkyo-*`).

## Points ouverts / questions

- Dates limites de candidature : pas dans le calendrier (non demandé) ; à ajouter en bordeaux si souhaité.
- Le code de connexion QR contient le jeton : affiché à la demande, masqué après 2 min.

- Vérifier sur le vrai GitHub : `listRuns(sha)` pour un push fait depuis l'app (API Git Data), durée des
  compilations suivantes (cache Tectonic), affichage des PDF en URL blob dans Chrome.
- Un CV utilisant des polices système (Arial…) échouera sur le runner Linux : préférer les polices de Tectonic.
- Idées non retenues : carte des localisations, statuts personnalisables.
- `MailComposer.tsx` n'est plus accessible depuis la fiche contact : le supprimer si l'utilisateur confirme.
- Contraste de la date du tableau de bord (gris sur Light blue) à revoir si gênant.
- Réimport .ics sur iPhone : mise à jour par UID ou doublon ? Non vérifié.
- Statut et priorité d'entreprise affichés aussi pour les réseaux et écoles : les masquer si l'utilisateur le souhaite.
