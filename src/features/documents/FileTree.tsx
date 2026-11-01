import * as RMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { ChevronRight, Copy, Download, Ellipsis, FileCode2, FilePlus2, FolderPlus, Pencil, Trash2, Upload } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import type { FileNode } from '../../../shared/types';
import { dirname } from '../../lib/files';
import { FileIcon, FolderIcon } from './fileTypes';

export type TreeAction = 'rename' | 'duplicate' | 'download' | 'delete' | 'new-letter' | 'new-tex' | 'new-folder' | 'upload';

/** Type MIME interne pour déplacer un élément de l'arborescence par glisser-déposer. */
export const INTERNAL_DRAG = 'application/x-trajectoire-path';

export function isFileDrag(e: DragEvent) {
  return e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes(INTERNAL_DRAG);
}

interface TreeProps {
  nodes: FileNode[];
  selected: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (node: FileNode) => void;
  onAction: (action: TreeAction, node: FileNode) => void;
  onDrop: (dir: string, e: DragEvent) => void;
}

function MenuItem({ icon, children, onSelect, danger }: { icon: ReactNode; children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <RMenu.Item
      onSelect={onSelect}
      className={clsx(
        'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] outline-none select-none [&_svg]:size-[15px]',
        danger ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-ink data-[highlighted]:bg-surface-2 [&_svg]:text-ink-3',
      )}
    >
      {icon}
      {children}
    </RMenu.Item>
  );
}

function Row({ node, depth, ...props }: TreeProps & { node: FileNode; depth: number }) {
  const { selected, expanded, onToggle, onSelect, onAction, onDrop } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isDir = node.type === 'dir';
  const open = isDir && expanded.has(node.path);
  const active = selected === node.path;
  const dropDir = isDir ? node.path : dirname(node.path);

  const act = (a: TreeAction) => () => onAction(a, node);

  return (
    <>
      <div
        role="treeitem"
        aria-selected={active}
        aria-expanded={isDir ? open : undefined}
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(INTERNAL_DRAG, node.path);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = e.dataTransfer.types.includes(INTERNAL_DRAG) ? 'move' : 'copy';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          onDrop(dropDir, e);
        }}
        onClick={() => (isDir ? onToggle(node.path) : onSelect(node))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isDir) onToggle(node.path);
            else onSelect(node);
          } else if (e.key === 'F2') {
            e.preventDefault();
            onAction('rename', node);
          } else if (e.key === 'Delete') {
            e.preventDefault();
            onAction('delete', node);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={clsx(
          'group relative flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[13px] outline-none select-none',
          'focus-visible:ring-2 focus-visible:ring-accent/40',
          active ? 'bg-surface font-medium text-ink shadow-xs ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          dragOver && 'bg-accent-soft ring-1 ring-accent/50',
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
        title={node.path}
      >
        {isDir ? (
          <ChevronRight className={clsx('size-3.5 shrink-0 text-ink-3 transition-transform duration-100', open && 'rotate-90')} />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isDir ? <FolderIcon open={open} className="size-[15px] shrink-0" /> : <FileIcon path={node.path} className="size-[15px] shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>

        <RMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <RMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Actions pour ${node.name}`}
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'flex size-6 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-surface-3 hover:text-ink',
                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
              )}
            >
              <Ellipsis className="size-4" />
            </button>
          </RMenu.Trigger>
          <RMenu.Portal>
            <RMenu.Content
              align="start"
              sideOffset={4}
              className="anim-menu z-50 min-w-[210px] rounded-xl border border-line bg-surface p-1 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              {isDir && (
                <>
                  <MenuItem icon={<FilePlus2 />} onSelect={act('new-letter')}>
                    Nouvelle lettre ici
                  </MenuItem>
                  <MenuItem icon={<FileCode2 />} onSelect={act('new-tex')}>
                    Nouveau fichier LaTeX ici
                  </MenuItem>
                  <MenuItem icon={<FolderPlus />} onSelect={act('new-folder')}>
                    Nouveau sous-dossier
                  </MenuItem>
                  <MenuItem icon={<Upload />} onSelect={act('upload')}>
                    Importer des fichiers ici
                  </MenuItem>
                  <RMenu.Separator className="my-1 h-px bg-line" />
                </>
              )}
              <MenuItem icon={<Pencil />} onSelect={act('rename')}>
                Renommer
              </MenuItem>
              <MenuItem icon={<Copy />} onSelect={act('duplicate')}>
                Dupliquer
              </MenuItem>
              {!isDir && (
                <MenuItem icon={<Download />} onSelect={act('download')}>
                  Télécharger
                </MenuItem>
              )}
              <RMenu.Separator className="my-1 h-px bg-line" />
              <MenuItem icon={<Trash2 />} onSelect={act('delete')} danger>
                Mettre à la corbeille
              </MenuItem>
            </RMenu.Content>
          </RMenu.Portal>
        </RMenu.Root>
      </div>
      {open && node.children?.map((child) => <Row key={child.path} node={child} depth={depth + 1} {...props} />)}
      {open && !node.children?.length && (
        <div className="py-1 text-[12px] text-ink-3 italic" style={{ paddingLeft: 6 + (depth + 1) * 14 + 20 }}>
          Dossier vide
        </div>
      )}
    </>
  );
}

export function FileTree(props: TreeProps) {
  return (
    <div role="tree" aria-label="Documents" className="space-y-px">
      {props.nodes.map((n) => (
        <Row key={n.path} node={n} depth={0} {...props} />
      ))}
    </div>
  );
}
