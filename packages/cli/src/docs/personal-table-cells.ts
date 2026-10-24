import type { PersonalTableFacts } from './personal-table-facts';

/** How a row of the CONTEXT.md and of the register writes one declared table. */
export interface PersonalTableCells {
  readonly table: string;
  readonly subject: string;
  /** The columns, then the files. */
  readonly kept: string;
  readonly erasure: string;
  readonly retention: string;
}

export function personalTableCells(table: PersonalTableFacts): PersonalTableCells {
  return {
    table: `\`${table.table}\``,
    subject: `\`${table.subject}\``,
    kept: table.files.length === 0 ? codes(table.fields) : `${codes(table.fields)}; files ${codes(table.files)}`,
    erasure: table.erasure === 'row' ? 'row deleted' : 'pseudonymised',
    retention: table.retention === undefined ? 'until erased' : table.retention.replace(/after (\S+)$/, 'after `$1`'),
  };
}

function codes(names: readonly string[]): string {
  return names.map((name) => `\`${name}\``).join(', ');
}
