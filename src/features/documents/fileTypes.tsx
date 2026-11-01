import { File, FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, FolderClosed, FolderOpen } from 'lucide-react';
import type { CSSProperties } from 'react';
import { extname } from '../../lib/files';

export type FileKind = 'tex' | 'letter' | 'docx' | 'pdf' | 'image' | 'text' | 'other';

const TEXT_EXT = ['.txt', '.md', '.cls', '.sty', '.bib', '.json', '.csv', '.log', '.bst', '.yml', '.yaml'];
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

export function fileKind(path: string): FileKind {
  const ext = extname(path);
  if (ext === '.tex') return 'tex';
  if (ext === '.html' || ext === '.htm') return 'letter';
  if (ext === '.docx') return 'docx';
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (TEXT_EXT.includes(ext)) return 'text';
  return 'other';
}

export const KIND_LABEL: Record<FileKind, string> = {
  tex: 'Document LaTeX',
  letter: 'Lettre',
  docx: 'Document Word',
  pdf: 'PDF',
  image: 'Image',
  text: 'Texte',
  other: 'Fichier',
};

export function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = extname(path);
  const kind = fileKind(path);
  const cls = className ?? 'size-4';
  const style = (color: string): CSSProperties => ({ color: `var(--c-${color})` });
  if (kind === 'tex') return <FileCode2 className={cls} style={style('green')} />;
  if (kind === 'letter') return <FileText className={cls} style={style('blue')} />;
  if (kind === 'docx') return <FileText className={cls} style={style('violet')} />;
  if (kind === 'pdf') return <FileText className={cls} style={style('red')} />;
  if (kind === 'image') return <FileImage className={cls} style={style('orange')} />;
  if (kind === 'text') return <FileCode2 className={cls} style={style('slate')} />;
  if (['.xlsx', '.xls', '.ods'].includes(ext)) return <FileSpreadsheet className={cls} style={style('green')} />;
  if (['.zip', '.7z', '.rar'].includes(ext)) return <FileArchive className={cls} style={style('slate')} />;
  return <File className={cls} style={style('slate')} />;
}

export function FolderIcon({ open, className }: { open?: boolean; className?: string }) {
  const Icon = open ? FolderOpen : FolderClosed;
  return <Icon className={className ?? 'size-4'} style={{ color: 'var(--ink-3)' }} />;
}

export function formatSize(bytes?: number) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}
