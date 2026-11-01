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

## Compilation des CV

Quand vous cliquez sur « Compiler » dans l'app, le `.tex` est enregistré ici. GitHub Actions le compile
avec Tectonic et ajoute le PDF à côté du fichier source (compter de 30 s à 1 min ; la toute première
compilation est plus longue). Vous pouvez aussi lancer une compilation depuis l'onglet **Actions** →
« Compilation LaTeX » → « Run workflow ».

Chaque action faite dans l'app crée un commit : l'historique Git garde toutes les versions.
