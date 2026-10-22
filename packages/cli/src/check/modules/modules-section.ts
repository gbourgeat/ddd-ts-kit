import { glossaryCells } from '../language/glossary-cells.js';

export const MODULES_HEADING = '## Modules';

/** One row of the `## Modules` table of a CONTEXT.md: the module it names, and its line, 1-based. */
export interface ModuleRow {
  readonly name: string;
  readonly line: number;
}

export interface ModulesSection {
  /** Line of the heading, 1-based, or undefined when the CONTEXT.md has no such section. */
  readonly line: number | undefined;
  readonly rows: readonly ModuleRow[];
  /** Line after which a new row belongs. */
  readonly lastRowLine: number | undefined;
}

/** Reads the `## Modules` table of a CONTEXT.md: one row per module of the model, its name in the first cell. */
export function modulesSection(contextDoc: string): ModulesSection {
  const lines = contextDoc.split('\n');
  const heading = lines.findIndex((line) => line.trim().toLowerCase() === MODULES_HEADING.toLowerCase());

  if (heading === -1) {
    return { line: undefined, rows: [], lastRowLine: undefined };
  }

  const end = lines.findIndex((line, index) => index > heading && line.startsWith('## '));

  const rows = lines
    .slice(heading + 1, end === -1 ? lines.length : end)
    .map((line, offset) => ({ line: heading + offset + 2, text: line.trim() }))
    .filter((row) => row.text.startsWith('|'));

  const named = rows
    .slice(1)
    .map((row) => ({ name: (glossaryCells(row.text)[0] ?? '').replace(/[`*_]/g, '').trim(), line: row.line }))
    .filter((row) => row.name !== '' && !/^:?-{2,}:?$/.test(row.name));

  return { line: heading + 1, rows: named, lastRowLine: rows.at(-1)?.line };
}
