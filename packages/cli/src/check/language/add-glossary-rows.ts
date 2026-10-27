import { glossaryCells } from './glossary-cells';
import { parseGlossary } from './parse-glossary';

/** Appends rows to the glossary table. Returns undefined when the document has no table to extend. */
export function addGlossaryRows(
  contextDoc: string,
  rows: readonly { term: string; meaning: string; notConfusedWith?: string }[],
): string | undefined {
  const glossary = parseGlossary(contextDoc);

  if (glossary.lastRowLine === undefined) {
    return undefined;
  }

  const lines = contextDoc.split('\n');
  const columns = glossaryCells(lines[glossary.lastRowLine - 1] ?? '').length;
  const known = glossary.terms.map((term) => term.toLowerCase());

  const additions = rows
    .filter((row) => !known.includes(row.term.toLowerCase()))
    .map((row) => `| ${cellsOf(row, columns).join(' | ')} |`);

  lines.splice(glossary.lastRowLine, 0, ...additions);

  return lines.join('\n');
}

/** The cells of a new row, as many as the table has: the third one, when given, is never dropped. */
function cellsOf(row: { term: string; meaning: string; notConfusedWith?: string }, columns: number): string[] {
  const third = row.notConfusedWith === undefined ? [] : [row.notConfusedWith];
  const cells = [row.term, row.meaning, ...third];

  return [...cells, ...Array.from({ length: Math.max(0, columns - cells.length) }, () => '')];
}
