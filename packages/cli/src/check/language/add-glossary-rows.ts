import { glossaryCells } from './glossary-cells.js';
import { parseGlossary } from './parse-glossary.js';

/** Appends rows to the glossary table. Returns undefined when the document has no table to extend. */
export function addGlossaryRows(
  contextDoc: string,
  rows: readonly { term: string; meaning: string }[],
): string | undefined {
  const glossary = parseGlossary(contextDoc);

  if (glossary.lastRowLine === undefined) {
    return undefined;
  }

  const lines = contextDoc.split('\n');
  const columns = glossaryCells(lines[glossary.lastRowLine - 1] ?? '').length;
  const known = glossary.terms.map((term) => term.toLowerCase());
  const padding = Array.from({ length: Math.max(0, columns - 2) }, () => '');

  const additions = rows
    .filter((row) => !known.includes(row.term.toLowerCase()))
    .map((row) => `| ${[row.term, row.meaning, ...padding].join(' | ')} |`);

  lines.splice(glossary.lastRowLine, 0, ...additions);

  return lines.join('\n');
}
