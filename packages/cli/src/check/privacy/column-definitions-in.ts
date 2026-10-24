import type { SourceFile } from '../model/source-file';

/** A column a persistence file of a context defines: as the database names it, the property that holds it, its line. */
export interface ColumnDefinition {
  readonly column: string;
  readonly property?: string;
  readonly line: number;
}

const COLUMN_TYPES =
  'text|string|varchar|char|uuid|integer|bigInteger|bigint|smallint|serial|boolean|date|dateTime|datetime|time|timestamp|timestamptz|json|jsonb|decimal|numeric|real|float|double|doublePrecision|binary|bytea|specificType|enu|enum';

/** Knex: `table.text('customer_email')`. */
const KNEX = new RegExp(String.raw`\b[\w$]+\.(?:${COLUMN_TYPES})\(\s*'([A-Za-z_][\w]*)'`, 'g');
/** Drizzle: `customerEmail: text('customer_email')`. */
const DRIZZLE = new RegExp(String.raw`\b([A-Za-z_$][\w$]*)\s*:\s*(?:${COLUMN_TYPES})\(\s*'([A-Za-z_][\w]*)'`, 'g');
/** TypeORM: `customerEmail: { name: 'customer_email', type: 'text' }`, or `email: { type: 'text' }`. */
const TYPEORM = /\b([A-Za-z_$][\w$]*)\s*:\s*\{\s*(?:name:\s*'([A-Za-z_][\w]*)'\s*,\s*)?type:\s*'/g;

/**
 * The columns a persistence file defines, read from the text the generator writes on the four
 * ORMs (the schema of a Knex table, a Drizzle table, a TypeORM entity schema). Strings and
 * comments are read from the text itself, at the offsets of the scan: a column named in a comment
 * is not one.
 */
export function columnDefinitionsIn(file: SourceFile): ColumnDefinition[] {
  const { code } = file.scan;
  const at = (offset: number): number => file.scan.lineAt(offset);
  const inCode = (offset: number): boolean => code.charAt(offset) === file.text.charAt(offset);

  return [
    ...[...file.text.matchAll(KNEX)]
      .filter((match) => inCode(match.index))
      .map((match) => ({ column: match[1] ?? '', line: at(match.index) })),
    ...[...file.text.matchAll(DRIZZLE)]
      .filter((match) => inCode(match.index))
      .map((match) => ({ column: match[2] ?? '', property: match[1] ?? '', line: at(match.index) })),
    ...(file.text.includes('EntitySchema')
      ? [...file.text.matchAll(TYPEORM)]
          .filter((match) => inCode(match.index) && match[1] !== 'columns' && match[1] !== 'relations')
          .map((match) => ({ column: match[2] ?? match[1] ?? '', property: match[1] ?? '', line: at(match.index) }))
      : []),
  ];
}
