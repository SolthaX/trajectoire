import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  type ParagraphChild,
} from 'docx';

/** Nœud JSON TipTap / ProseMirror. */
interface JNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

// Mise en page identique à la feuille de l'éditeur : A4, marges 24 × 22 mm, Calibri 11 pt.
const MM = 56.7; // twips par millimètre

function inline(nodes: JNode[] = [], extra: { font?: string } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  let breaks = 0;
  for (const n of nodes) {
    if (n.type === 'hardBreak') {
      breaks++;
      continue;
    }
    if (n.type !== 'text') continue;
    const marks = new Set((n.marks ?? []).map((m) => m.type));
    const link = n.marks?.find((m) => m.type === 'link');
    const run = new TextRun({
      text: n.text ?? '',
      bold: marks.has('bold') || undefined,
      italics: marks.has('italic') || undefined,
      underline: marks.has('underline') || link ? {} : undefined,
      strike: marks.has('strike') || undefined,
      font: marks.has('code') ? 'Consolas' : extra.font,
      break: breaks || undefined,
    });
    breaks = 0;
    out.push(link?.attrs?.href ? new ExternalHyperlink({ link: String(link.attrs.href), children: [run] }) : run);
  }
  if (breaks) out.push(new TextRun({ text: '', break: breaks }));
  return out;
}

interface Ctx {
  list?: { reference: string; level: number; instance: number };
  quote?: boolean;
}

function blocks(nodes: JNode[] = [], ctx: Ctx, counter: { n: number }): Paragraph[] {
  const out: Paragraph[] = [];
  for (const node of nodes) {
    const align = ALIGN[String(node.attrs?.textAlign ?? '')];
    const indent = ctx.quote ? { left: Math.round(8 * MM) } : undefined;
    switch (node.type) {
      case 'paragraph':
        out.push(
          new Paragraph({
            children: inline(node.content),
            alignment: align,
            indent,
            numbering: ctx.list ? { reference: ctx.list.reference, level: ctx.list.level, instance: ctx.list.instance } : undefined,
            spacing: ctx.list ? { after: 40 } : undefined,
          }),
        );
        break;
      case 'heading': {
        const level = Math.min(4, Math.max(1, Number(node.attrs?.level ?? 1)));
        out.push(new Paragraph({ heading: HEADINGS[level - 1], children: inline(node.content), alignment: align }));
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const reference = node.type === 'bulletList' ? 'puces' : 'numeros';
        const level = ctx.list ? Math.min(3, ctx.list.level + 1) : 0;
        const instance = node.type === 'orderedList' && !ctx.list ? ++counter.n : (ctx.list?.instance ?? 0);
        for (const item of node.content ?? []) {
          const [first, ...rest] = item.content ?? [];
          if (first) out.push(...blocks([first], { ...ctx, list: { reference, level, instance } }, counter));
          // Paragraphes suivants d'un même élément : en retrait, sans puce ; sous-listes : niveau suivant.
          for (const child of rest) {
            if (child.type === 'bulletList' || child.type === 'orderedList') {
              out.push(...blocks([child], { ...ctx, list: { reference, level, instance } }, counter));
            } else {
              out.push(...blocks([child], { quote: ctx.quote }, counter));
            }
          }
        }
        if (!ctx.list) out.push(new Paragraph({ spacing: { after: 0 }, children: [] }));
        break;
      }
      case 'blockquote':
        out.push(...blocks(node.content, { ...ctx, quote: true }, counter));
        break;
      case 'horizontalRule':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D5D4CD', space: 1 } }, children: [] }));
        break;
      case 'codeBlock':
        out.push(new Paragraph({ children: inline(node.content, { font: 'Consolas' }), indent }));
        break;
      default:
        if (node.content) out.push(...blocks(node.content, ctx, counter));
    }
  }
  return out;
}

export async function tiptapToDocx(json: JNode, title: string): Promise<Blob> {
  const counter = { n: 0 };
  const children = blocks(json.content, {}, counter);
  const bulletChars = ['•', '◦', '▪', '•'];
  const doc = new Document({
    creator: 'Trajectoire',
    title,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '141413' },
          paragraph: { spacing: { after: 187, line: 336 } },
        },
        heading1: { run: { font: 'Calibri', size: 32, bold: true, color: '141413' }, paragraph: { spacing: { after: 160 } } },
        heading2: { run: { font: 'Calibri', size: 26, bold: true, color: '141413' }, paragraph: { spacing: { before: 200, after: 120 } } },
        heading3: { run: { font: 'Calibri', size: 23, bold: true, color: '141413' }, paragraph: { spacing: { before: 200, after: 100 } } },
      },
    },
    numbering: {
      config: [
        {
          reference: 'puces',
          levels: [0, 1, 2, 3].map((l) => ({
            level: l,
            format: LevelFormat.BULLET,
            text: bulletChars[l],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360 + l * 360, hanging: 260 } } },
          })),
        },
        {
          reference: 'numeros',
          levels: [0, 1, 2, 3].map((l) => ({
            level: l,
            format: l % 2 === 0 ? LevelFormat.DECIMAL : LevelFormat.LOWER_LETTER,
            text: `%${l + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 400 + l * 360, hanging: 300 } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: Math.round(24 * MM), bottom: Math.round(24 * MM), left: Math.round(22 * MM), right: Math.round(22 * MM) },
          },
        },
        children: children.length ? children : [new Paragraph({ children: [] })],
      },
    ],
  });
  return Packer.toBlob(doc);
}
