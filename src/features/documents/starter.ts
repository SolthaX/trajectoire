// Contenu créé au premier lancement si le dossier documents est vide.

export const STARTER_CV_TEX = String.raw`% CV d'exemple — compilé avec Tectonic (moteur XeTeX).
% Remplacez le contenu, gardez la structure : \section, \entry, \skills.
\documentclass[10pt,a4paper]{article}

\usepackage[a4paper, top=16mm, bottom=16mm, left=18mm, right=18mm]{geometry}
\usepackage{fontspec}
\setmainfont{texgyreheros}[
  Extension = .otf,
  UprightFont = *-regular,
  BoldFont = *-bold,
  ItalicFont = *-italic,
  BoldItalicFont = *-bolditalic,
]
\usepackage[french]{babel}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{tabularx}
\usepackage[hidelinks]{hyperref}

% --- Couleurs sobres -------------------------------------------------------
\definecolor{ink}{HTML}{141413}
\definecolor{muted}{HTML}{6F6E68}
\definecolor{accent}{HTML}{1C5CAB}
\definecolor{rule}{HTML}{D5D4CD}
\color{ink}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\linespread{1.08}

% --- Titres de section : petites capitales espacées + filet -----------------
\newcommand{\sectiontitle}[1]{{\addfontfeatures{LetterSpace=8}\MakeUppercase{#1}}}
\newcommand{\sectionrule}{{\color{rule}\hrule height 0.6pt}}
\titleformat{\section}
  {\color{accent}\normalsize\bfseries}
  {}{0pt}{\sectiontitle}[\vspace{3pt}\sectionrule]
\titlespacing*{\section}{0pt}{12pt}{6pt}

\setlist[itemize]{leftmargin=1.1em, label={\color{muted}\textbullet}, itemsep=1pt, topsep=3pt, parsep=0pt}

% \entry{Poste}{Dates}{Entreprise}{Lieu}
\newcommand{\entry}[4]{%
  \par\noindent\textbf{#1}\hfill{\color{muted}\small #2}\\
  {\color{muted}#3\ifx&#4&\else\ · #4\fi}\par\vspace{2pt}}

% \skills{Catégorie}{Liste}
\newcommand{\skills}[2]{%
  \noindent\begin{tabularx}{\linewidth}{@{}p{32mm}X@{}}\textbf{#1} & #2\end{tabularx}\par\vspace{2pt}}

\begin{document}

% --- En-tête -----------------------------------------------------------------
{\fontsize{24}{28}\selectfont\bfseries Prénom Nom}\par
\vspace{3pt}
{\large\color{accent} Intitulé du poste visé}\par
\vspace{6pt}
{\small\color{muted}
  Paris, France \quad·\quad
  \href{mailto:prenom.nom@email.fr}{prenom.nom@email.fr} \quad·\quad
  06 12 34 56 78 \quad·\quad
  \href{https://www.linkedin.com/in/prenom-nom}{linkedin.com/in/prenom-nom}\par}

\vspace{8pt}
{\small Deux ou trois lignes de présentation : votre expertise, ce que vous apportez,
le type de poste et d'environnement recherchés. Restez concret et orienté résultats.\par}

\section{Expérience}

\entry{Intitulé du poste}{Jan. 2022 — Aujourd'hui}{Entreprise}{Ville}
\begin{itemize}
  \item Réalisation marquante, chiffrée si possible (ex. réduction de 30\,\% des délais).
  \item Projet piloté : périmètre, équipe, budget, résultat obtenu.
  \item Compétence mise en œuvre et impact pour le client ou l'équipe.
\end{itemize}
\vspace{4pt}

\entry{Intitulé du poste}{Sept. 2019 — Déc. 2021}{Entreprise}{Ville}
\begin{itemize}
  \item Réalisation marquante, chiffrée si possible.
  \item Responsabilité clé et résultat.
\end{itemize}

\section{Formation}

\entry{Diplôme — Spécialité}{2019}{École ou université}{Ville}

\section{Compétences}

\skills{Métier}{Compétence, compétence, compétence}
\skills{Outils}{Outil, outil, outil}
\skills{Langues}{Français (natif), anglais (courant)}

\section{Centres d'intérêt}

{\small Une ou deux lignes qui en disent un peu plus sur vous.\par}

\end{document}
`;

const LETTER_BODY = `<p>{{mon_prenom}} {{mon_nom}}<br>Adresse<br>Téléphone · Email</p>
<p style="text-align: right">{{entreprise}}<br>À l'attention de {{civilite}} {{nom}}</p>
<p style="text-align: right">Paris, le {{date}}</p>
<p><strong>Objet : candidature au poste de {{poste}}</strong></p>
<p>{{civilite}},</p>
<p style="text-align: justify">Premier paragraphe : pourquoi {{entreprise}} et pourquoi ce poste. Montrez que vous connaissez l'entreprise, ses projets et ses enjeux.</p>
<p style="text-align: justify">Deuxième paragraphe : ce que vous apportez. Une ou deux réalisations concrètes, chiffrées si possible, en lien direct avec les besoins du poste de {{poste}}.</p>
<p style="text-align: justify">Troisième paragraphe : ce que vous attendez de cette collaboration et votre disponibilité pour un entretien.</p>
<p style="text-align: justify">Je vous prie d'agréer, {{civilite}}, l'expression de mes salutations distinguées.</p>
<p style="text-align: right">{{mon_prenom}} {{mon_nom}}</p>`;

/** Document HTML autonome d'une lettre (lisible et imprimable hors de l'app). */
export function letterDocument(body: string, title = 'Lettre') {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title.replace(/</g, '&lt;')}</title>
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; background: #fff; }
.lettre { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 24mm 22mm;
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
  font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #141413; }
.lettre p { margin: 0 0 0.85em; }
.lettre h1 { font-size: 16pt; margin: 0 0 0.6em; } .lettre h2 { font-size: 13pt; margin: 1em 0 0.5em; } .lettre h3 { font-size: 11.5pt; margin: 1em 0 0.4em; }
.lettre ul, .lettre ol { margin: 0 0 0.85em; padding-left: 1.4em; }
.lettre li p { margin: 0 0 0.25em; }
.lettre blockquote { margin: 0 0 0.85em; padding-left: 1em; border-left: 2px solid #d5d4cd; color: #52514e; }
.lettre a { color: inherit; }
</style>
</head>
<body>
<article class="lettre">
${body}
</article>
</body>
</html>
`;
}

export const STARTER_LETTER_HTML = letterDocument(LETTER_BODY, 'Lettre de motivation — modèle');
