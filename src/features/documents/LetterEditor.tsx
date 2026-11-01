import { useQueryClient } from '@tanstack/react-query';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorContent, Extension, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  CircleAlert,
  FileDown,
  Italic,
  List,
  ListOrdered,
  Printer,
  Redo2,
  Save,
  Underline,
  Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { EmptyState, Loading } from '../../components/ui/misc';
import { Menu } from '../../components/ui/overlay';
import { errorMessage } from '../../lib/api';
import { fileKeys, filesApi, stem, useFileText } from '../../lib/files';
import { tiptapToDocx } from './docxExport';
import { downloadBlob, extractLetterBody, letterDocument, printLetter } from './letter';
import { SaveStatus, useFitScale, useSaveShortcut, ViewerHeader, type SaveState } from './shared';

/** Met en évidence les {{variables}} des modèles dans l'éditeur. */
const VariableHighlight = Extension.create({
  name: 'variableHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variableHighlight'),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const re = /\{\{\s*[a-zA-Z_]+\s*\}\}/g;
              let m: RegExpExecArray | null;
              while ((m = re.exec(node.text))) {
                decos.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { class: 'lettre-var' }));
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

const A4_WIDTH = 794; // 210 mm à 96 dpi

export function LetterEditor({ path, onDirtyChange }: { path: string; onDirtyChange: (dirty: boolean) => void }) {
  const file = useFileText(path);
  if (file.isLoading) return <Loading />;
  if (file.error || !file.data)
    return <EmptyState icon={<CircleAlert />} title="Impossible d'ouvrir ce fichier" description={errorMessage(file.error)} />;
  return <LetterEditorInner path={path} initialHtml={file.data.content} onDirtyChange={onDirtyChange} />;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        'flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-35 [&_svg]:size-[15px]',
        active ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-4 w-px bg-line" aria-hidden />;

const BLOCK_STYLES = [
  { key: 'p', label: 'Paragraphe' },
  { key: 'h1', label: 'Titre 1' },
  { key: 'h2', label: 'Titre 2' },
  { key: 'h3', label: 'Titre 3' },
] as const;

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      block: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'p',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const blockLabel = BLOCK_STYLES.find((b) => b.key === s.block)?.label ?? 'Paragraphe';

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-line bg-surface px-3 py-1.5">
      <ToolButton label="Annuler (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Rétablir (Ctrl+Y)" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolButton>
      <Sep />
      <Menu
        align="start"
        width="min-w-[160px]"
        trigger={
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            className="flex h-7 w-[118px] items-center justify-between gap-1 rounded-md px-2 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {blockLabel}
            <ChevronDown className="size-3.5 text-ink-3" />
          </button>
        }
        items={BLOCK_STYLES.map((b) => ({
          label: b.label,
          checked: s.block === b.key,
          onSelect: () => {
            if (b.key === 'p') chain().setParagraph().run();
            else chain().setHeading({ level: Number(b.key[1]) as 1 | 2 | 3 }).run();
          },
        }))}
      />
      <Sep />
      <ToolButton label="Gras (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italique (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="Souligné (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </ToolButton>
      <Sep />
      <ToolButton label="Liste à puces" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Liste numérotée" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <Sep />
      <ToolButton label="Aligner à gauche" active={s.left} onClick={() => chain().setTextAlign('left').run()}>
        <AlignLeft />
      </ToolButton>
      <ToolButton label="Centrer" active={s.center} onClick={() => chain().setTextAlign('center').run()}>
        <AlignCenter />
      </ToolButton>
      <ToolButton label="Aligner à droite" active={s.right} onClick={() => chain().setTextAlign('right').run()}>
        <AlignRight />
      </ToolButton>
      <ToolButton label="Justifier" active={s.justify} onClick={() => chain().setTextAlign('justify').run()}>
        <AlignJustify />
      </ToolButton>
    </div>
  );
}

function LetterEditorInner({
  path,
  initialHtml,
  onDirtyChange,
}: {
  path: string;
  initialHtml: string;
  onDirtyChange: (d: boolean) => void;
}) {
  const qc = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialBody = useMemo(() => extractLetterBody(initialHtml), [initialHtml]);
  const title = stem(path);
  const { ref: fitRef, scale } = useFitScale(A4_WIDTH, 64);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
        codeBlock: false,
        code: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Placeholder.configure({ placeholder: 'Rédigez votre lettre…' }),
      VariableHighlight,
    ],
    content: initialBody || '<p></p>',
    editorProps: { attributes: { class: 'lettre-content', spellcheck: 'true', lang: 'fr' } },
    onUpdate: () => setDirty(true),
  });

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    if (!editor || saving) return;
    const content = letterDocument(editor.getHTML(), title);
    setSaving(true);
    try {
      const res = await filesApi.saveText(path, content);
      qc.setQueryData(fileKeys.text(path), { path, content, mtime: res.mtime });
      setDirty(false);
    } catch (e) {
      toast.error(`Enregistrement impossible : ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  useSaveShortcut(() => void save());

  const exportDocx = async () => {
    if (!editor) return;
    try {
      const blob = await tiptapToDocx(editor.getJSON(), title);
      downloadBlob(blob, `${title}.docx`);
    } catch (e) {
      toast.error(`Export Word impossible : ${errorMessage(e)}`);
    }
  };

  const exportPdf = () => {
    if (!editor) return;
    printLetter(editor.getHTML(), title);
    toast.message('Choisissez « Enregistrer au format PDF » comme imprimante.', { duration: 6000 });
  };

  const saveState: SaveState = saving ? 'saving' : dirty ? 'dirty' : 'saved';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path} status={<SaveStatus state={saveState} />}>
        <Menu
          trigger={
            <Button size="sm" icon={<FileDown />}>
              Exporter
              <ChevronDown className="!size-3.5 text-ink-3" />
            </Button>
          }
          items={[
            { label: 'PDF (impression)', icon: <Printer />, onSelect: exportPdf },
            { label: 'Document Word (.docx)', icon: <FileDown />, onSelect: () => void exportDocx() },
          ]}
        />
        <Button variant="primary" size="sm" icon={<Save />} onClick={() => void save()} disabled={!dirty || saving} title="Enregistrer (Ctrl+S)">
          Enregistrer
        </Button>
      </ViewerHeader>
      {editor && <Toolbar editor={editor} />}
      <div ref={fitRef} className="lettre-desk min-h-0 flex-1 overflow-auto">
        <div className="lettre-sheet-wrap" style={{ zoom: scale }}>
          <div className="lettre-sheet" onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
