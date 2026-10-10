import { glossaryCells } from './glossary-cells.js';

const GLOSSARY_HEADING = '## Ubiquitous language';

export interface Glossary {
  readonly terms: readonly string[];
  /** Line of the section heading, 1-based, or undefined when the section is missing. */
  readonly line: number | undefined;
  /** Line after which a new row belongs. */
  readonly lastRowLine: number | undefined;
}

/** Reads the `## Ubiquitous language` table of a CONTEXT.md. */
export function parseGlossary(contextDoc: string): Glossary {
  const lines = contextDoc.split('\n');
  const heading = lines.findIndex((line) => line.trim().toLowerCase() === GLOSSARY_HEADING.toLowerCase());

  if (heading === -1) return { terms: [], line: undefined, lastRowLine: undefined };

  const end = lines.findIndex((line, index) => index > heading && line.startsWith('## '));

  const rows = lines
    .slice(heading + 1, end === -1 ? lines.length : end)
    .map((line, offset) => ({ line: heading + offset + 2, cells: glossaryCells(line), isRow: line.trim().startsWith('|') }))
    .filter((row) => row.isRow);

  return { terms: termsOf(rows.map((row) => row.cells)), line: heading + 1, lastRowLine: rows.at(-1)?.line };
}

/** The first row of a table is its header. */
function termsOf(rows: readonly (readonly string[])[]): string[] {
  return rows
    .slice(1)
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)))
    .map((cells) => (cells[0] ?? '').replace(/[`*_]/g, '').trim())
    .filter((term) => term !== '');
}
