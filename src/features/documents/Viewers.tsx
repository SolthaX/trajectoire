import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Download, ExternalLink, FilePen, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, IconButton } from '../../components/ui/button';
import { EmptyState, Loading } from '../../components/ui/misc';
import { errorMessage } from '../../lib/api';
import { dirname, downloadFile, extname, fileKeys, filesApi, findNode, stem, uniqueName, useFileBlobUrl, useFileText, useFileTree } from '../../lib/files';
import { CodeEditor } from './CodeEditor';
import { fileKind, FileIcon, formatSize, KIND_LABEL } from './fileTypes';
import { letterDocument } from './letter';
import { SaveStatus, useFitScale, useSaveShortcut, ViewerHeader, type SaveState } from './shared';

const download = (path: string) => void downloadFile(path).catch((e) => toast.error(errorMessage(e)));

function DownloadButton({ path }: { path: string }) {
  return (
    <IconButton label="Télécharger" onClick={() => download(path)}>
      <Download />
    </IconButton>
  );
}

// --- Texte brut ---------------------------------------------------------------
export function TextViewer({ path, onDirtyChange }: { path: string; onDirtyChange: (d: boolean) => void }) {
  const file = useFileText(path);
  if (file.isLoading) return <Loading />;
  if (file.error || !file.data)
    return <EmptyState icon={<CircleAlert />} title="Impossible d'ouvrir ce fichier" description={errorMessage(file.error)} />;
  return <TextViewerInner path={path} initial={file.data.content} onDirtyChange={onDirtyChange} />;
}

function TextViewerInner({ path, initial, onDirtyChange }: { path: string; initial: string; onDirtyChange: (d: boolean) => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = code !== saved;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    if (!dirty || saving) return;
    const content = code;
    setSaving(true);
    try {
      const res = await filesApi.saveText(path, content);
      setSaved(content);
      qc.setQueryData(fileKeys.text(path), { path, content, mtime: res.mtime, sha: '' });
    } catch (e) {
      toast.error(`Enregistrement impossible : ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };
  useSaveShortcut(() => void save());
  const state: SaveState = saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const latexLike = ['.cls', '.sty', '.bib', '.bst'].includes(extname(path));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path} status={<SaveStatus state={state} />}>
        <DownloadButton path={path} />
        <Button variant="primary" size="sm" icon={<Save />} onClick={() => void save()} disabled={!dirty || saving} title="Enregistrer (Ctrl+S)">
          Enregistrer
        </Button>
      </ViewerHeader>
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeEditor value={code} onChange={setCode} language={latexLike ? 'latex' : 'plain'} />
      </div>
    </div>
  );
}

// --- Word (.docx) ---------------------------------------------------------------
export function DocxViewer({ path, onOpen }: { path: string; onOpen: (path: string) => void }) {
  const tree = useFileTree();
  const { ref: fitRef, scale } = useFitScale(794, 64);
  const [converting, setConverting] = useState(false);
  const q = useQuery({
    queryKey: fileKeys.docx(path),
    queryFn: () => filesApi.docxHtml(path),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const convert = async () => {
    if (!q.data) return;
    setConverting(true);
    try {
      const target = uniqueName(tree.data, dirname(path), `${stem(path)}.html`);
      await filesApi.saveText(target, letterDocument(q.data.html, stem(path)), { message: `Conversion en lettre : ${target}` });
      toast.success('Lettre éditable créée');
      onOpen(target);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path} status={<span className="text-[11.5px] text-ink-3">Aperçu en lecture seule</span>}>
        <DownloadButton path={path} />
        <Button variant="primary" size="sm" icon={<FilePen />} onClick={() => void convert()} disabled={!q.data || converting}>
          Convertir en lettre éditable
        </Button>
      </ViewerHeader>
      {q.isLoading ? (
        <Loading label="Conversion de l'aperçu…" />
      ) : q.error ? (
        <EmptyState icon={<CircleAlert />} title="Aperçu impossible" description={errorMessage(q.error)} />
      ) : (
        <div ref={fitRef} className="lettre-desk min-h-0 flex-1 overflow-auto">
          <div className="lettre-sheet-wrap" style={{ zoom: scale }}>
            <div className="lettre-sheet">
              {/* HTML produit par mammoth à partir du .docx (pas de script possible). */}
              <div className="lettre-content" dangerouslySetInnerHTML={{ __html: q.data?.html || '<p><em>Document vide</em></p>' }} />
            </div>
          </div>
          {!!q.data?.messages.length && (
            <p className="mx-auto max-w-[794px] px-6 pb-8 text-center text-[11.5px] text-ink-3">
              Certains éléments de mise en forme n'ont pas pu être repris dans l'aperçu ({q.data.messages.length}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// --- PDF ------------------------------------------------------------------------
export function PdfViewer({ path }: { path: string }) {
  const file = useFileBlobUrl(path);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path}>
        <IconButton label="Ouvrir dans un onglet" disabled={!file.url} onClick={() => file.url && window.open(file.url, '_blank')}>
          <ExternalLink />
        </IconButton>
        <DownloadButton path={path} />
      </ViewerHeader>
      <div className="relative min-h-0 flex-1 bg-surface-2">
        {file.error ? (
          <EmptyState icon={<CircleAlert />} title="Lecture impossible" description={errorMessage(file.error)} />
        ) : file.url ? (
          <iframe key={file.url} title={path} src={file.url} className="absolute inset-0 size-full border-0" />
        ) : (
          <Loading label="Chargement du PDF…" />
        )}
      </div>
    </div>
  );
}

// --- Image ----------------------------------------------------------------------
export function ImageViewer({ path }: { path: string }) {
  const file = useFileBlobUrl(path);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path} status={<span className="text-[11.5px] text-ink-3">{formatSize(file.size)}</span>}>
        <IconButton label="Ouvrir dans un onglet" disabled={!file.url} onClick={() => file.url && window.open(file.url, '_blank')}>
          <ExternalLink />
        </IconButton>
        <DownloadButton path={path} />
      </ViewerHeader>
      <div className="doc-checker flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
        {file.error ? (
          <EmptyState icon={<CircleAlert />} title="Lecture impossible" description={errorMessage(file.error)} />
        ) : file.url ? (
          <img src={file.url} alt={path} className="max-h-full max-w-full rounded-md object-contain shadow-md" />
        ) : (
          <Loading label="Chargement de l'image…" />
        )}
      </div>
    </div>
  );
}

// --- Autres ---------------------------------------------------------------------
export function OtherViewer({ path }: { path: string }) {
  const tree = useFileTree();
  const node = tree.data ? findNode(tree.data, path) : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewerHeader path={path}>
        <DownloadButton path={path} />
      </ViewerHeader>
      <EmptyState
        icon={<FileIcon path={path} />}
        title="Aperçu non disponible"
        description={`${KIND_LABEL[fileKind(path)]} ${extname(path) || ''} · ${formatSize(node?.size)}. Téléchargez-le pour l'ouvrir avec l'application adaptée.`}
        action={
          <Button icon={<Download />} onClick={() => download(path)}>
            Télécharger
          </Button>
        }
      />
    </div>
  );
}
