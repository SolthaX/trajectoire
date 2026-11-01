# Reprise — Trajectoire (dashboard de recherche d'emploi)

> Dernière mise à jour : 2026-11-02 00:10 · branche `main` · aucun commit (publication en attente de `scripts/publier-github.sh`)
> Fichier maintenu par `/end` (lu par `/start`). Aucune donnée sensible ici.

## Indicateurs

| Indicateur | Valeur |
|---|---|
| Objectifs du jalon en cours | 6/8 (75 %) : reste la publication et le premier vrai test GitHub |
| Tests | Pas de suite dans le dépôt ; 26 vérifications navigateur (Playwright, hors dépôt) passées : 13 version statique, 8 synchro 2 appareils, 5 documents |
| Lint / typecheck | `npm run typecheck` OK · `npm run build` OK |
| Commits (total / depuis la dernière reprise) | 0 / 0 |
| Modifications non commitées | tout le projet |

## État actuel

Web app 100 % navigateur, sur le modèle de Benkyō (JapaneseStudy) : destinée à GitHub Pages, installable
depuis Chrome et épinglable à la barre des tâches. L'API Hono + SQLite (WASM) tourne dans la page
(`src/backend/`), les données sont persistées dans IndexedDB et l'app fonctionne hors ligne (service worker).
La synchro (données `trajectoire.json` + `documents/`) passe par un dépôt GitHub **privé**, et la compilation
LaTeX par GitHub Actions (Tectonic). Tout a été testé contre un faux GitHub en mémoire, rien encore sur le vrai.

## Fait lors de la dernière session

- V1 locale (serveur Node + lancer.bat), puis bascule vers une web app statique à la demande de l'utilisateur.
- Backend embarqué : ids générés côté client, suppressions mémorisées, fusion déterministe « le plus récent l'emporte ».
- Client GitHub (`src/lib/github.ts`) : commits atomiques via l'API Git Data, rejeu en cas de conflit.
- Module Documents porté sur GitHub (agent) + workflow `repo-template/.github/workflows/latex.yml`.
- Web app installable : manifeste, icônes, service worker généré au build, 404.html pour les liens profonds,
  bouton « Installer l'app », indicateur de synchro, clés localStorage préfixées `trajectoire:` (origine
  github.io partagée avec Benkyō).
- Supprimés : serveur Node, lancer.bat / lancer.sh, script d'installation Tectonic local.

## En cours

- Publication : la création des dépôts a été bloquée par le garde-fou d'autorisations, l'utilisateur doit
  lancer `./scripts/publier-github.sh` (ou autoriser l'action).

## Objectifs (jalon : web app publiée et épinglée)

- [x] Backend dans le navigateur + persistance locale + hors ligne
- [x] Synchro GitHub (dépôt privé) testée sur deux appareils simulés
- [x] Documents + compilation LaTeX via GitHub Actions
- [x] Web app installable (manifeste, icônes, service worker)
- [x] Workflow de déploiement GitHub Pages
- [x] README à jour
- [ ] Publier : `./scripts/publier-github.sh` (dépôt public `trajectoire` + Pages, dépôt privé `trajectoire-donnees`)
- [ ] Premier vrai test : jeton fine-grained, synchro, compilation du CV d'exemple, aperçu PDF dans Chrome

## Prochaine étape proposée

Lancer `./scripts/publier-github.sh`, créer le jeton (Contents RW + Actions RW, limité à `trajectoire-donnees`),
ouvrir `https://solthax.github.io/trajectoire/` dans Chrome, installer et épingler, connecter GitHub dans
Paramètres, puis compiler le CV d'exemple.

## Décisions prises

- 2026-11-01 : V1 en web app locale (serveur Node), abandonnée le lendemain.
- 2026-11-02 : architecture Benkyō, sur demande : GitHub Pages, pas de serveur, données dans le navigateur.
- 2026-11-02 : dépôt GitHub privé plutôt qu'un gist secret (contacts = données personnelles ; documents ; historique).
- 2026-11-02 : compilation LaTeX par GitHub Actions (le serveur de paquets de SwiftLaTeX ne répond plus, et
  envoyer le CV à un service tiers a été écarté).
- 2026-11-02 : jeton fine-grained limité au dépôt privé, gardé dans le navigateur, jamais synchronisé ;
  l'app refuse un dépôt public.
- 2026-11-01 : statuts définis dans `shared/constants.ts`.

## Points ouverts / questions

- Vérifier sur le vrai GitHub : durée du premier passage du workflow LaTeX (≈ 1 min 30, téléchargement des
  paquets), `listRuns(sha)` pour un push via l'API, affichage des PDF en URL blob dans Chrome.
- Un CV utilisant des polices système (Arial…) échouera sur le runner Linux : préférer les polices de Tectonic.
- Idées non retenues : carte des localisations, statuts personnalisables.
