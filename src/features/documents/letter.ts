import { letterDocument } from './starter';

export { letterDocument };

/** Extrait le corps éditable d'une lettre (document complet ou simple fragment). */
export function extractLetterBody(html: string): string {
  if (!/<(html|body|article)[\s>]/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const article = doc.querySelector('article.lettre');
  return (article ?? doc.body).innerHTML.trim();
}

/** Impression (→ « Enregistrer au format PDF ») via une iframe invisible. */
export function printLetter(bodyHtml: string, title: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  iframe.srcdoc = letterDocument(bodyHtml, title);
  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  iframe.onload = () => {
    const w = iframe.contentWindow;
    if (!w) return cleanup();
    w.onafterprint = cleanup;
    // Laisse le temps aux polices de se charger avant d'ouvrir la boîte d'impression.
    const fonts = w.document.fonts?.ready ?? Promise.resolve();
    fonts.then(() => {
      w.focus();
      w.print();
    });
    setTimeout(() => iframe.isConnected && iframe.remove(), 120_000);
  };
  document.body.appendChild(iframe);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Fichier .tex vierge proposé à la création. */
export const BLANK_TEX = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[a4paper, margin=22mm]{geometry}
\usepackage{fontspec}
\usepackage[french]{babel}
\usepackage[hidelinks]{hyperref}

\begin{document}

Bonjour !

\end{document}
`;
