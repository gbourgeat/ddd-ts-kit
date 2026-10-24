import type { PersonalColumn } from './personal-column';

/** The lines a template adds to a table or a row definition, one per column. */
export function columnLines(columns: readonly PersonalColumn[], line: (column: PersonalColumn) => string): string {
  return columns.map(line).join('\n');
}
