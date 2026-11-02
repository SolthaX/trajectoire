# Reprise — Trajectoire (dashboard de recherche d'emploi)

> Dernière mise à jour : 2026-11-02 11:05 · branche `main` · commit `f8821b9` · en ligne : https://solthax.github.io/trajectoire/
> Fichier maintenu par `/end` (lu par `/start`). Aucune donnée sensible ici.

## Indicateurs

| Indicateur | Valeur |
|---|---|
| Objectifs du jalon en cours | 7/8 (88 %) : reste le premier test réel avec le jeton |
| Tests | Pas de suite dans le dépôt ; 26 vérifications navigateur (Playwright, hors dépôt) passées : 13 version statique, 8 synchro 2 appareils, 5 documents |
| Lint / typecheck | `npm run typecheck` OK · `npm run build` OK |
| Commits (total / depuis la dernière reprise) | 3 / 2 |
| Modifications non commitées | aucune |

## État actuel

Web app 100 % navigateur, sur le modèle de Benkyō (JapaneseStudy) : destinée à GitHub Pages, installable
depuis Chrome et épinglable à la barre des tâches. L'API Hono + SQLite (WASM) tourne dans la page
(`src/backend/`), les données sont persistées dans IndexedDB et l'app fonctionne hors ligne (service worker).
La synchro (données `trajectoire.json` + `documents/`) passe par un dépôt GitHub **privé**, et la compilation
LaTeX par GitHub Actions (Tectonic). Tout a été testé contre un faux GitHub en mémoire, rien encore sur le vrai.

## Fait lors de la dernière session

- Correctif : l'icône Benkyō ouvrait Trajectoire (même id de manifeste `./` → racine du domaine).
  Ids absolus `/trajectoire/` (contrôlé au build) et `/JapaneseStudy/`, vérifiés dans Chromium (`Page.getAppId`).
- Benkyō ne supprime plus les caches ni le localStorage des autres apps de l'origine ; SW des deux apps en `cache: 'reload'`.
- JapaneseStudy cloné dans `~/projets/JapaneseStudy` (commit `85a738b`, poussé).

## En cours

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

## Prochaine étape proposée

Réinstaller proprement les deux apps dans Chrome (voir « En cours »), puis créer le jeton (Contents RW +
Actions RW, limité à `trajectoire-donnees`), connecter GitHub dans les Paramètres de Trajectoire,
ouvrir le CV d'exemple (le PDF existe déjà) et recompiler après une modification.

## Décisions prises

- 2026-11-01 : V1 en web app locale (serveur Node), abandonnée le lendemain.
- 2026-11-02 : architecture Benkyō, sur demande : GitHub Pages, pas de serveur, données dans le navigateur.
- 2026-11-02 : dépôt GitHub privé plutôt qu'un gist secret (contacts = données personnelles ; documents ; historique).
- 2026-11-02 : compilation LaTeX par GitHub Actions (le serveur de paquets de SwiftLaTeX ne répond plus, et
  envoyer le CV à un service tiers a été écarté).
- 2026-11-02 : jeton fine-grained limité au dépôt privé, gardé dans le navigateur, jamais synchronisé ;
  l'app refuse un dépôt public.
- 2026-11-01 : statuts définis dans `shared/constants.ts`.
- 2026-11-02 : chaque app de `solthax.github.io` a un id de manifeste absolu (`/trajectoire/`, `/JapaneseStudy/`),
  contrôlé au build pour Trajectoire. Sur l'origine partagée, chaque app ne touche qu'à ses propres caches et
  clés (`trajectoire-*` / `trajectoire:*`, `benkyo-*`).

## Points ouverts / questions

- Vérifier sur le vrai GitHub : `listRuns(sha)` pour un push fait depuis l'app (API Git Data), durée des
  compilations suivantes (cache Tectonic), affichage des PDF en URL blob dans Chrome.
- Un CV utilisant des polices système (Arial…) échouera sur le runner Linux : préférer les polices de Tectonic.
- Idées non retenues : carte des localisations, statuts personnalisables.
