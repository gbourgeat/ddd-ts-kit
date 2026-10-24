import {
  ERASED_PERSONAL_DATA,
  NotADataSubjectIdError,
  NotNullablePersonalColumnError,
  isDataSubjectId,
  pseudonymisedValueOf,
  type PersonalDataErasure,
  type PersonalDataRetention,
} from '@ddd-ts-kit/kernel';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import { aboutSubject, type Condition } from './about-subject';
import { expiredRows } from './expired-rows';
import { pathOf } from './path-of';
import type { PrismaPersonalDataErasureOptions } from './prisma-personal-data-erasure-options';
import type { PrismaPersonalFields } from './prisma-personal-fields';
import type { PrismaRawCommands } from './prisma-raw-commands';
import { quoted } from './quoted';
import { rawRows } from './raw-rows';

/** A personal column and what it reads once pseudonymised: the marker for a text, nothing for anything else or for a file. */
interface Pseudonymised {
  readonly column: string;
  readonly erased: string | null;
}

/** What the catalogue says of a column: its SQL type, and whether it accepts null. */
interface Column {
  readonly type: string;
  readonly nullable: boolean;
}

/**
 * The erasure of a data subject from the tables a context declared with `personalFields`, on
 * Prisma: the files the rows name are deleted from the storage first, then the rows of the subject
 * are deleted (`row`) or their personal columns pseudonymised (`pseudonymise`: a text reads
 * `ERASED_PERSONAL_DATA`, any other type nothing, a file column nothing). Prisma builds no statement
 * on a column it does not know at build time, so the statements are written here, on PostgreSQL,
 * with quoted identifiers that come from the declarations and every value a `$n` parameter; they
 * run on the client of the unit of work and, for tenant data, in the tenant of the work alone. The
 * port of the context extends `PersonalDataErasure` and its adapter extends this class:
 * `class PrismaPatientErasure extends PrismaPersonalDataErasure<Prisma.TransactionClient> implements PatientErasure`.
 * The same declarations give the storage limitation: `purgeExpired(now)` erases, as each declaration
 * says, the rows whose `retention` ended.
 */
export class PrismaPersonalDataErasure<Tx extends PrismaRawCommands>
  implements PersonalDataErasure, PersonalDataRetention
{
  readonly name: string;

  private readonly columns = new Map<string, Promise<Readonly<Record<string, Column>>>>();

  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly options: PrismaPersonalDataErasureOptions,
  ) {
    this.name = options.name;
    assertFilesReachable(options);
  }

  /** The rows reached in every declared table, none the second time. A subject that is not an opaque id is refused before any statement. */
  async erase(subject: string): Promise<number> {
    if (!isDataSubjectId(subject)) {
      throw new NotADataSubjectIdError();
    }

    let reached = 0;

    for (const declaration of this.options.declarations) {
      reached += await this.eraseIn(declaration, aboutSubject(declaration, subject, this.options.tenant));
    }

    return reached;
  }

  /** The rows whose retention ended before `now`, in every declared table that gives one, none the second time. */
  async purgeExpired(now: Date): Promise<number> {
    let reached = 0;

    for (const declaration of this.options.declarations.filter((declared) => declared.retention !== undefined)) {
      reached += await this.eraseIn(declaration, expiredRows(declaration, { now, tenant: this.options.tenant }));
    }

    return reached;
  }

  /** What a pseudonymisation would write is settled, and refused, before any file or row is touched. */
  private async eraseIn(declaration: PrismaPersonalFields, about: Condition): Promise<number> {
    const pseudonymised = declaration.erasure === 'row' ? undefined : await this.pseudonymisedOf(declaration);

    await this.deleteFilesOf(declaration, about);

    return pseudonymised === undefined
      ? this.deleteRows(declaration, about)
      : this.pseudonymise(declaration, about, pseudonymised);
  }

  /** The content first, then the reference: a row that still names a deleted file is run again, a file nothing names is lost. */
  private async deleteFilesOf(declaration: PrismaPersonalFields, about: Condition): Promise<void> {
    const storage = this.options.files;

    if (declaration.files.length === 0 || storage === undefined) {
      return;
    }

    const anyFile = declaration.files.map((file) => `${quoted(file)} is not null`).join(' or ');
    const columns = declaration.files.map(quoted).join(', ');

    const rows = await rawRows(
      this.context.client(),
      `select ${columns} from ${pathOf(declaration)} where ${about.text} and (${anyFile})`,
      about.values,
    );

    for (const key of rows.flatMap((row) => declaration.files.map((file) => row[file]))) {
      if (typeof key === 'string') {
        await storage.delete(key);
      }
    }
  }

  private deleteRows(declaration: PrismaPersonalFields, about: Condition): Promise<number> {
    return this.context
      .client()
      .$executeRawUnsafe(`delete from ${pathOf(declaration)} where ${about.text}`, ...about.values);
  }

  private pseudonymise(
    declaration: PrismaPersonalFields,
    about: Condition,
    pseudonymised: readonly Pseudonymised[],
  ): Promise<number> {
    const changes = pseudonymised.map(
      ({ column }, index) => `${quoted(column)} = $${String(about.values.length + index + 1)}`,
    );

    const marker = `$${String(about.values.length + pseudonymised.length + 1)}`;

    return this.context
      .client()
      .$executeRawUnsafe(
        `update ${pathOf(declaration)} set ${changes.join(', ')} where ${about.text} and (${notYetErased(pseudonymised, marker)})`,
        ...about.values,
        ...pseudonymised.map(({ erased }) => erased),
        ERASED_PERSONAL_DATA,
      );
  }

  /** Each personal column and what it reads once pseudonymised: the marker for a text, nothing for anything else or for a file, which the column has to accept. */
  private async pseudonymisedOf(declaration: PrismaPersonalFields): Promise<Pseudonymised[]> {
    const columns = await this.columnsOf(declaration);
    const columnOf = (name: string): Column => knownColumn(columns, name, pathOf(declaration));

    const pseudonymised = [
      ...declaration.fields.map((field) => ({ column: field, erased: pseudonymisedValueOf(columnOf(field).type) })),
      ...declaration.files.map((file) => ({ column: file, erased: null })),
    ];

    for (const { column, erased } of pseudonymised) {
      if (erased === null && !columnOf(column).nullable) {
        throw new NotNullablePersonalColumnError(pathOf(declaration), column);
      }
    }

    return pseudonymised;
  }

  /** What the catalogue says of each column of the table, read once: a text is pseudonymised, anything else emptied. */
  private columnsOf({ table }: PrismaPersonalFields): Promise<Readonly<Record<string, Column>>> {
    const name = `${table.schema ?? ''}.${table.table}`;
    const known = this.columns.get(name);

    if (known !== undefined) {
      return known;
    }

    const read = rawRows(
      this.context.client(),
      'select column_name, data_type, is_nullable from information_schema.columns where table_schema = coalesce($1, current_schema()) and table_name = $2',
      [table.schema ?? null, table.table],
    ).then((rows) =>
      Object.fromEntries(
        rows.map((row) => [
          String(row['column_name']),
          { type: String(row['data_type']), nullable: row['is_nullable'] === 'YES' },
        ]),
      ),
    );

    this.columns.set(name, read);

    return read;
  }
}

/** A row is reached while one personal column still holds something: a text other than the marker, any other value, a file. */
function notYetErased(pseudonymised: readonly Pseudonymised[], marker: string): string {
  return pseudonymised
    .map(({ column, erased }) =>
      erased === null
        ? `${quoted(column)} is not null`
        : `(${quoted(column)} is not null and ${quoted(column)} <> ${marker})`,
    )
    .join(' or ');
}

/** The column as the catalogue knows it: a declaration that names one the table does not have is refused before any statement on the rows. */
function knownColumn(columns: Readonly<Record<string, Column>>, name: string, table: string): Column {
  const column = columns[name];

  if (column === undefined) {
    throw new Error(`The table ${table} has no column "${name}": the declaration names one it does not have`);
  }

  return column;
}

function assertFilesReachable({ declarations, files }: PrismaPersonalDataErasureOptions): void {
  const naming = declarations.find((declaration) => declaration.files.length > 0);

  if (naming !== undefined && files === undefined) {
    throw new Error(
      `The declaration of ${naming.table.table} names file columns (${naming.files.join(', ')}) and no file storage was given: the files of an erased person would stay in the storage`,
    );
  }
}
