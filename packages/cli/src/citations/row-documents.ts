import fs from 'node:fs';
import path from 'node:path';
import { markdownUnder } from '../check/project/markdown-under';
import { SLICES_FILE } from '../progress/read-slices';
import type { Slice } from '../progress/slice';
import type { DocumentPart } from './document-part';
import { partsOfDocument } from './parts-of-document';
import { partsOfSlices } from './parts-of-slices';

/** Where the plan, the design notes and the reviews of a project live. */
const ARCHITECTURE_DOCS = 'docs/architecture';
/** `X.fr.md` next to `X.md`: a translation says what its original says. */
const TRANSLATION = /^(.*)\.[a-z]{2}(?:-[A-Za-z]{2})?\.md$/;

/**
 * Every part of the design of the project, each with the rows of the slices table it belongs
 * to: the cells and rule lines of each row in the slices file, then the parts of the other
 * Markdown files of docs/architecture. Left out: the slices file read as a document, the
 * documents written before the bootstrap, and a translation whose original is there.
 */
export function rowDocuments(root: string, slices: readonly Slice[]): DocumentPart[] {
  const ids = [...new Set(slices.map((row) => row.id))];
  const { parts, links } = partsOfSlices(textOf(root, SLICES_FILE), ids);

  return [
    ...parts,
    ...designDocuments(root).flatMap((document) =>
      partsOfDocument({ path: document, text: textOf(root, document) }, ids, links.get(document) ?? []),
    ),
  ];
}

function designDocuments(root: string): string[] {
  const documents = markdownUnder(root, ARCHITECTURE_DOCS);
  const known = new Set(documents);

  return documents.filter((document) => {
    const original = TRANSLATION.exec(document)?.[1];
    const translation = original !== undefined && known.has(`${original}.md`);

    return document !== SLICES_FILE && !document.startsWith(`${ARCHITECTURE_DOCS}/before-bootstrap/`) && !translation;
  });
}

function textOf(root: string, file: string): string {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return '';
  }
}
