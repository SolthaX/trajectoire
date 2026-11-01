#!/usr/bin/env bash
# Publie Trajectoire sur GitHub :
#   1. dépôt public de l'app (code seulement) + GitHub Pages ;
#   2. dépôt privé des données et documents (initialisé depuis repo-template/).
# Sans risque à relancer : ce qui existe déjà est conservé.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

OWNER="$(gh api user --jq .login)"
APP_REPO="${APP_REPO:-trajectoire}"
DATA_REPO="${DATA_REPO:-trajectoire-donnees}"

echo "→ Vérification du code (typecheck + build)…"
npm run build --silent >/dev/null

echo "→ 1/3 Dépôt public de l'app : $OWNER/$APP_REPO"
git add -A
if ! git diff --cached --quiet; then
  git commit -q -F - <<'MSG'
Trajectoire : web app de recherche d'emploi (GitHub Pages)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
fi
if ! gh repo view "$OWNER/$APP_REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$APP_REPO" --public --description "Trajectoire · web app pour piloter sa recherche d'emploi" >/dev/null
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$APP_REPO.git"
git push -q -u origin main

echo "→ 2/3 Activation de GitHub Pages (déploiement par GitHub Actions)"
gh api -X POST "repos/$OWNER/$APP_REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$OWNER/$APP_REPO/pages" -f build_type=workflow >/dev/null
sleep 2
gh workflow run deploy.yml -R "$OWNER/$APP_REPO" >/dev/null 2>&1 || true

echo "→ 3/3 Dépôt privé des données : $OWNER/$DATA_REPO"
if gh repo view "$OWNER/$DATA_REPO" >/dev/null 2>&1; then
  echo "  (existe déjà : laissé tel quel)"
else
  gh repo create "$OWNER/$DATA_REPO" --private --description "Trajectoire : données et documents (privé)" >/dev/null
  TMP="$(mktemp -d)"
  cp -r repo-template/. "$TMP"
  (
    cd "$TMP"
    git init -q -b main
    git add -A
    git commit -q -m "Initialisation (documents de départ + compilation LaTeX)"
    git remote add origin "https://github.com/$OWNER/$DATA_REPO.git"
    git push -q -u origin main
  )
  rm -rf "$TMP"
fi

cat <<FIN

Terminé.
  App      : https://$OWNER.github.io/$APP_REPO/   (en ligne d'ici 1 à 2 minutes)
  Données  : https://github.com/$OWNER/$DATA_REPO   (privé)

Il reste à créer le jeton d'accès (limité au dépôt $DATA_REPO) :
  https://github.com/settings/personal-access-tokens/new
  → Repository access : Only select repositories → $DATA_REPO
  → Permissions : Contents = Read and write, Actions = Read and write
puis à le coller dans l'app : Paramètres → Synchronisation GitHub.
FIN
