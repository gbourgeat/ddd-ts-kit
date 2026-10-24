import type { ErasureMode } from './erasure-mode';
import { InvalidPersonalFieldsError } from './invalid-personal-fields-error';

/** The columns of one table that hold personal data, and whose: what an erasure, an export and a register read. */
export interface PersonalFields<Row, Table = unknown> {
  /** The table as the persistence package names it: a Drizzle table, a Knex target, a Prisma model name. */
  readonly table: Table;
  /** The column that names the data subject a row is about: an opaque identifier, never personal data itself. */
  readonly subject: keyof Row & string;
  /** The columns that hold personal data of that subject. */
  readonly fields: readonly (keyof Row & string)[];
  readonly erasure: ErasureMode;
  /** Columns that hold the key of a file of the subject in the file storage: the file is deleted and the column emptied, whatever the mode. */
  readonly files: readonly (keyof Row & string)[];
}

export interface PersonalFieldsOptions<Row> {
  readonly subject: keyof Row & string;
  readonly fields: readonly (keyof Row & string)[];
  readonly erasure: ErasureMode;
  readonly files?: readonly (keyof Row & string)[];
}

/**
 * Declares, next to the mapper of a table, which of its columns are personal and whose they are:
 * `personalFields<PersonRow>(PERSONS, { subject: 'id', fields: ['display_name', 'email'], erasure: 'row' })`.
 * One declaration, read by the erasure adapter of the persistence package, by the export, by the
 * generated register and by the `privacy/*` rules. A table without personal data declares nothing.
 * Refused: no field, a column listed twice, and a subject column that is itself declared
 * personal, since an identifier that is personal data (an email) cannot name a data subject.
 */
export function personalFields<Row, Table = unknown>(
  table: Table,
  { subject, fields, erasure, files = [] }: PersonalFieldsOptions<Row>,
): PersonalFields<Row, Table> {
  const personal = [...fields, ...files];

  if (fields.length === 0) {
    throw new InvalidPersonalFieldsError('names no personal field');
  }

  if (personal.includes(subject)) {
    throw new InvalidPersonalFieldsError(
      `names its subject column "${subject}" as personal data: a data subject is an opaque identifier`,
    );
  }

  if (new Set(personal).size !== personal.length) {
    throw new InvalidPersonalFieldsError('lists a column twice');
  }

  return { table, subject, fields, erasure, files };
}
