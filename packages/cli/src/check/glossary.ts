import { splitWords } from '../naming.js';
import { sameWord } from './inflection.js';

/** The `## Ubiquitous language` table of a CONTEXT.md, shared by the checker and the generator. */

const GLOSSARY_HEADING = '## Ubiquitous language';

/** Words that name a role of the architecture, not a concept of the business. */
const STRUCTURAL_WORDS = new Set(['repository', 'handler', 'command', 'query', 'event', 'error', 'service', 'id', 'port', 'publisher', 'consumer', 'builder']);
/** Link words of compound names such as MarkedAsPaid. */
const LINK_WORDS = new Set(['a', 'an', 'the', 'as', 'of', 'by', 'for', 'to', 'in', 'on', 'at', 'and', 'or', 'with', 'from', 'per', 'is', 'not']);

export interface Glossary {
  readonly terms: readonly string[];
  /** Line of the section heading, 1-based, or undefined when the section is missing. */
  readonly line: number | undefined;
  /** Line after which a new row belongs. */
  readonly lastRowLine: number | undefined;
}

export function parseGlossary(contextDoc: string): Glossary {
  const lines = contextDoc.split('\n');
  const heading = lines.findIndex((line) => line.trim().toLowerCase() === GLOSSARY_HEADING.toLowerCase());
  if (heading === -1) return { terms: [], line: undefined, lastRowLine: undefined };
  const end = lines.findIndex((line, index) => index > heading && line.startsWith('## '));
  const rows = lines
    .slice(heading + 1, end === -1 ? lines.length : end)
    .map((line, offset) => ({ line: heading + offset + 2, cells: cellsOf(line), isRow: line.trim().startsWith('|') }))
    .filter((row) => row.isRow);
  // The first row of a table is its header.
  const terms = rows
    .slice(1)
    .filter((row) => !isSeparator(row.cells))
    .map((row) => (row.cells[0] ?? '').replace(/[`*_]/g, '').trim())
    .filter((term) => term !== '');
  return { terms, line: heading + 1, lastRowLine: rows.at(-1)?.line };
}

function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/** The words of `name` that no term of the glossary covers. */
export function unknownWords(name: string, glossary: Glossary): string[] {
  const known = glossary.terms.flatMap((term) => splitWords(term));
  return splitWords(name).filter(
    (word) => !STRUCTURAL_WORDS.has(word) && !LINK_WORDS.has(word) && !/^v?\d+$/.test(word) && !known.some((term) => sameWord(term, word)),
  );
}

/** Appends rows to the glossary table. Returns undefined when the document has no table to extend. */
export function addGlossaryRows(contextDoc: string, rows: readonly { term: string; meaning: string }[]): string | undefined {
  const glossary = parseGlossary(contextDoc);
  if (glossary.lastRowLine === undefined) return undefined;
  const lines = contextDoc.split('\n');
  const columns = cellsOf(lines[glossary.lastRowLine - 1] ?? '').length;
  const known = glossary.terms.map((term) => term.toLowerCase());
  const additions = rows
    .filter((row) => !known.includes(row.term.toLowerCase()))
    .map((row) => `| ${[row.term, row.meaning, ...Array.from({ length: Math.max(0, columns - 2) }, () => '')].join(' | ')} |`);
  lines.splice(glossary.lastRowLine, 0, ...additions);
  return lines.join('\n');
}
