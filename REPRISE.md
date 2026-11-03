# Reprise — Trajectoire (dashboard de recherche d'emploi)

> Dernière mise à jour : 2026-11-02 18:42 · branche `main` · commit `5bfbf65` · en ligne : https://solthax.github.io/trajectoire/
> Fichier maintenu par `/end` (lu par `/start`). Aucune donnée sensible ici.

## Indicateurs

| Indicateur | Valeur |
|---|---|
| Objectifs du jalon en cours | 7/8 (88 %) : reste le premier test réel avec le jeton · jalon « usage » : 4/5 |
| Tests | Pas de suite dans le dépôt ; 26 vérifications navigateur (Playwright, hors dépôt) + 2026-11-02 : import d'instantané ancien format sans perte, compilation rapide testée depuis Chromium (PDF 0,8 s, erreurs extraites) |
| Lint / typecheck | `npm run typecheck` OK · `npm run build` OK |
| Commits (total / depuis la dernière reprise) | 10 / 6 |
| Modifications non commitées | aucune |

## État actuel

Web app 100 % navigateur, sur le modèle de Benkyō (JapaneseStudy) : destinée à GitHub Pages, installable
depuis Chrome et épinglable à la barre des tâches. L'API Hono + SQLite (WASM) tourne dans la page
(`src/backend/`), les données sont persistées dans IndexedDB et l'app fonctionne hors ligne (service worker).
La synchro (données `trajectoire.json` + `documents/`) passe par un dépôt GitHub **privé**, et la compilation
LaTeX par GitHub Actions (Tectonic). Tout a été testé contre un faux GitHub en mémoire, rien encore sur le vrai.

## Fait lors de la dernière session

- Contacts : plusieurs emails / téléphones (stockés une valeur par ligne dans `email` / `phone`, sans migration).
- Échanges planifiés : sens `prevu` + colonne `link` (lien visio) dans `interactions` ; types WhatsApp et SMS ;
  exclus des stats d'activité. Onglet **À envoyer** (`src/features/planned/PlannedPage.tsx`), bouton « Fait »,
  « Copier le message » ; « Planifier un échange » remplace « Écrire un mail » sur la fiche contact ;
  groupe « Messages et calls prévus » dans l'À faire du tableau de bord.
- `importSnapshot` ignore les colonnes inconnues (un appareil pas à jour ne plante plus sur un instantané plus récent).
- Palette : Alabaster, Tan, Light blue, Midnight blue, Maroon + Corail, Safran, Sauge, Prune (`src/styles.css`) ;
  fond Light blue, barre latérale `.side` Midnight blue (Maroon en sombre), boutons primaires `bg-brand`.
- Compilation LaTeX **rapide** en option (Paramètres › Compilation LaTeX) via latex.ytotech.com (`compileFast`
  dans `src/lib/files.ts`) : ~2 s, commit `[skip ci]` ; GitHub Actions reste le défaut.

## En cours

- L'utilisateur a 4 contacts réels dans l'app : toute évolution doit préserver les données (instantané compatible).
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
- [x] Un contact lié à plusieurs entreprises, avec un rôle par lien (2026-11-03, non commité)
- [x] Type d'entreprise (entreprise / réseau-association / école) : Shift Project Paris, AX, l'X… sont des
      « entreprises » de type réseau
- [x] Onglet Networking : événements (base, statut d'inscription, contacts rencontrés, préparation / bilan)
- [x] Section « Mes réseaux » : mes appartenances et mon rôle (ex. shifter au Shift Project Paris)

## Prochaine étape proposée

Connecter GitHub dans les Paramètres (si pas déjà fait), activer « Rapide » dans Paramètres › Compilation LaTeX,
compiler le CV d'exemple et vérifier : PDF dans le dépôt, journal `.latex/`, aucune exécution Actions déclenchée.

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
- 2026-11-02 : chaque app de `solthax.github.io` a un id de manifeste absolu (`/trajectoire/`, `/JapaneseStudy/`),
  contrôlé au build pour Trajectoire. Sur l'origine partagée, chaque app ne touche qu'à ses propres caches et
  clés (`trajectoire-*` / `trajectoire:*`, `benkyo-*`).

## Points ouverts / questions

- Vérifier sur le vrai GitHub : `listRuns(sha)` pour un push fait depuis l'app (API Git Data), durée des
  compilations suivantes (cache Tectonic), affichage des PDF en URL blob dans Chrome.
- Un CV utilisant des polices système (Arial…) échouera sur le runner Linux : préférer les polices de Tectonic.
- Idées non retenues : carte des localisations, statuts personnalisables.
- `MailComposer.tsx` n'est plus accessible depuis la fiche contact : le supprimer si l'utilisateur confirme.
- Contraste de la date du tableau de bord (gris sur Light blue) à revoir si gênant.
