// Index des chemins de documents (relatifs au dossier documents/), alimenté par
// le module Documents après chaque chargement de l'arborescence GitHub.
// Utilisé par la recherche globale (Ctrl K).

let index: string[] = [];

export function setFileIndex(paths: string[]) {
  index = paths;
}

export function getFileIndex() {
  return index;
}
