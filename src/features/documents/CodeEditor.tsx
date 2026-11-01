import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import CodeMirror, { EditorView, Prec } from '@uiw/react-codemirror';
import { useMemo } from 'react';
import { useIsDark } from './shared';

const latex = StreamLanguage.define(stex);

// Ajuste les couleurs de fond aux jetons de l'app (clair comme sombre).
const appTheme = Prec.highest(
  EditorView.theme({
    '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--surface)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
    '.cm-content': { padding: '14px 0 40vh' },
    '.cm-gutters': {
      backgroundColor: 'var(--surface)',
      borderRight: '1px solid var(--line)',
      color: 'var(--ink-3)',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--surface-2) 75%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink-2)' },
    '.cm-line': { padding: '0 16px 0 10px' },
  }),
);

export function CodeEditor({
  value,
  onChange,
  language = 'plain',
}: {
  value: string;
  onChange: (v: string) => void;
  language?: 'latex' | 'plain';
}) {
  const dark = useIsDark();
  const extensions = useMemo(
    () => [EditorView.lineWrapping, appTheme, ...(language === 'latex' ? [latex] : [])],
    [language],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={dark ? 'dark' : 'light'}
      extensions={extensions}
      height="100%"
      className="h-full min-h-0"
      basicSetup={{ foldGutter: false, autocompletion: false, searchKeymap: true, highlightActiveLine: true }}
    />
  );
}
