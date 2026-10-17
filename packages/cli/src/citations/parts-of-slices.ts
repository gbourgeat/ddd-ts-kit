import path from 'node:path';
import { cellsOf } from '../progress/cells-of.js';
import { SLICES_FILE } from '../progress/read-slices.js';
import { RULE_LINE } from '../progress/rule-line.js';
import type { DocumentPart, PartText } from './document-part.js';

/** The design each row has in the slices file, and the documents its rule lines link to, by document. */
export interface SlicesParts {
  readonly parts: readonly DocumentPart[];
  readonly links: ReadonlyMap<string, readonly string[]>;
}

/** A Markdown link to a document, an anchor after it left out. */
const LINK = /\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g;
const CITED_DOCUMENT = /`(docs\/architecture\/[^`\s]+\.md)`/g;
const COLUMNS = 8;

/**
 * The part of the slices file each row of `ids` owns: its `Slice` and `Start with` cells, each
 * read alone, and the text of its rule lines `- #<row>: ...`. A document its rule line links to
 * (a Markdown link, or `docs/architecture/...md` as code) belongs to the row as a whole.
 */
export function partsOfSlices(text: string, ids: readonly string[]): SlicesParts {
  const texts = new Map<string, PartText[]>();
  const links = new Map<string, string[]>();

  text.split('\n').forEach((content, index) => {
    const line = index + 1;
    const cells = cellsOf(content);
    const [id = '', , , slice = '', startWith = ''] = cells;
    const [, ruled = '', rule = ''] = RULE_LINE.exec(content) ?? [];

    if (cells.length === COLUMNS && ids.includes(id)) {
      added(texts, id, { line, text: slice }, { line, text: startWith });
    }

    if (ids.includes(ruled)) {
      added(texts, ruled, { line, text: rule });
      linkedDocuments(rule).forEach((document) => added(links, document, ruled));
    }
  });

  return { parts: [...texts].map(([id, owned]) => ({ document: SLICES_FILE, rows: [id], texts: owned })), links };
}

function added<T>(map: Map<string, T[]>, key: string, ...values: readonly T[]): void {
  map.set(key, [...(map.get(key) ?? []), ...values]);
}

function linkedDocuments(rule: string): string[] {
  const directory = path.posix.dirname(SLICES_FILE);

  const linked = [...rule.matchAll(LINK)].map(([, target = '']) =>
    path.posix.normalize(path.posix.join(directory, target)),
  );

  return [...linked, ...[...rule.matchAll(CITED_DOCUMENT)].map(([, document = '']) => document)];
}
