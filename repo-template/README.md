# Données de Trajectoire (dépôt privé)

Ce dépôt **privé** sert de stockage à l'application Trajectoire (pilotage de recherche d'emploi).
Gardez-le privé : il contient vos contacts, vos candidatures et vos documents.

## Contenu

| Élément | Rôle |
|---|---|
| `trajectoire.json` | Toutes les données de l'app (entreprises, contacts, offres, entretiens…). Écrit par l'app : **ne pas le modifier à la main**. |
| `documents/` | Vos documents (CV LaTeX, lettres, PDF, pièces diverses), édités depuis la page Documents de l'app. |
| `documents/.corbeille/` | Éléments supprimés depuis l'app (récupérables). |
| `.latex/` | Journaux de compilation des CV LaTeX. |
| `.github/workflows/latex.yml` | Compile les `.tex` en PDF à chaque modification (GitHub Actions). |
| `.github/workflows/calendrier.yml` | Met à jour le calendrier iCloud « Trajectoire » (script `.github/calendrier/icloud.py`), lancé par l'app. |

## Compilation des CV

Quand vous cliquez sur « Compiler » dans l'app, le `.tex` est enregistré ici. GitHub Actions le compile
avec Tectonic et ajoute le PDF à côté du fichier source (compter de 30 s à 1 min ; la toute première
compilation est plus longue). Vous pouvez aussi lancer une compilation depuis l'onglet **Actions** →
« Compilation LaTeX » → « Run workflow ».

## Calendrier Apple (iCloud)

Une minute après une synchro qui change le calendrier, l'app lance un workflow GitHub Actions qui met à
jour un calendrier iCloud « Trajectoire » (créé au premier passage) : événements de networking, entretiens, relances et messages / calls prévus. Le calendrier
apparaît automatiquement sur l'iPhone et le Mac. Seuls les éléments créés par Trajectoire sont modifiés ;
ne les éditez pas dans Calendrier (la synchro suivante les rétablirait), modifiez-les dans l'app.

Pour l'activer, créez un mot de passe d'application (https://account.apple.com → Connexion et sécurité →
Mots de passe d'app), puis ajoutez deux secrets au dépôt (Settings → Secrets and variables → Actions) :
`ICLOUD_USER` (votre Apple ID) et `ICLOUD_APP_PASSWORD`. Sans eux, le workflow ne fait rien.

Chaque action faite dans l'app crée un commit : l'historique Git garde toutes les versions.
