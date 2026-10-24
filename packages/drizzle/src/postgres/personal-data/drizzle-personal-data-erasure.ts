import { getTableColumns, sql, type SQL, type TablesRelationalConfig } from 'drizzle-orm';
import { getTableConfig, type PgColumn, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  ERASED_PERSONAL_DATA,
  NotADataSubjectIdError,
  NotNullablePersonalColumnError,
  isDataSubjectId,
  pseudonymisedValueOf,
  type PersonalDataErasure,
  type PersonalDataRetention,
} from '@ddd-ts-kit/kernel';
import { columnOf } from '../read-model/column-of';
import { rowsOf } from '../read-model/rows-of';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';
import { aboutSubject } from './about-subject';
import type { DrizzlePersonalDataErasureOptions } from './drizzle-personal-data-erasure-options';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';
import { expiredRows } from './expired-rows';
import { named } from './named';
import { tableSqlOf } from './table-sql-of';

/** A personal column and what it reads once pseudonymised: the marker for a text, nothing for anything else or for a file. */
interface Pseudonymised {
  readonly column: PgColumn;
  readonly erased: string | null;
}

/**
 * The erasure of a data subject from the tables a context declared with `personalFields`, on
 * Drizzle: the files the rows name are deleted from the storage first, then the rows of the subject
 * are deleted (`row`) or their personal columns pseudonymised (`pseudonymise`: a text reads
 * `ERASED_PERSONAL_DATA`, any other type nothing, a file column nothing). Every statement runs on
 * the executor of the unit of work and, for tenant data, in the tenant of the work alone. The port
 * of the context extends `PersonalDataErasure` and its adapter extends this class:
 * `class DrizzlePatientErasure extends DrizzlePersonalDataErasure<NodePgQueryResultHKT> implements PatientErasure`.
 * The same declarations give the storage limitation: `purgeExpired(now)` erases, as each declaration
 * says, the rows whose `retention` ended.
 */
export class DrizzlePersonalDataErasure<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = TablesRelationalConfig,
> implements PersonalDataErasure, PersonalDataRetention
{
  readonly name: string;

  constructor(
    private readonly context: DrizzleContext<Q, F, S>,
    private readonly options: DrizzlePersonalDataErasureOptions,
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
  private async eraseIn(declaration: DrizzlePersonalFields, rows: SQL): Promise<number> {
    const pseudonymised = declaration.erasure === 'row' ? undefined : pseudonymisedOf(declaration);

    await this.deleteFilesOf(declaration, rows);

    return pseudonymised === undefined
      ? this.deleteRows(declaration, rows)
      : this.pseudonymise(declaration, rows, pseudonymised);
  }

  /** The content first, then the reference: a row that still names a deleted file is run again, a file nothing names is lost. */
  private async deleteFilesOf(declaration: DrizzlePersonalFields, rows: SQL): Promise<void> {
    const storage = this.options.files;

    if (declaration.files.length === 0 || storage === undefined) {
      return;
    }

    const files = declaration.files.map((file) => columnOf(getTableColumns(declaration.table), file));

    const anyFile = sql.join(
      files.map((file) => sql`${named(file)} is not null`),
      sql` or `,
    );

    const withFiles = rowsOf(
      await this.context
        .executor()
        .execute(
          sql`select ${sql.join(files.map(named), sql`, `)} from ${tableSqlOf(declaration)} where ${rows} and (${anyFile})`,
        ),
    );

    for (const key of withFiles.flatMap((row) => files.map((file) => row[file.name]))) {
      if (typeof key === 'string') {
        await storage.delete(key);
      }
    }
  }

  private async deleteRows(declaration: DrizzlePersonalFields, rows: SQL): Promise<number> {
    const deleted = await this.context
      .executor()
      .execute(sql`delete from ${tableSqlOf(declaration)} where ${rows} returning 1`);

    return rowsOf(deleted).length;
  }

  private async pseudonymise(
    declaration: DrizzlePersonalFields,
    rows: SQL,
    pseudonymised: readonly Pseudonymised[],
  ): Promise<number> {
    const changes = sql.join(
      pseudonymised.map(({ column, erased }) => sql`${named(column)} = ${erased}`),
      sql`, `,
    );

    const updated = await this.context
      .executor()
      .execute(
        sql`update ${tableSqlOf(declaration)} set ${changes} where ${rows} and (${notYetErased(pseudonymised)}) returning 1`,
      );

    return rowsOf(updated).length;
  }
}

/** Each personal column and what it reads once pseudonymised: the marker for a text, nothing for anything else or for a file, which the column has to accept. */
function pseudonymisedOf(declaration: DrizzlePersonalFields): Pseudonymised[] {
  const columns = getTableColumns(declaration.table);

  const pseudonymised = [
    ...declaration.fields.map((field) => {
      const column = columnOf(columns, field);

      return { column, erased: pseudonymisedValueOf(column.getSQLType()) };
    }),
    ...declaration.files.map((file) => ({ column: columnOf(columns, file), erased: null })),
  ];

  for (const { column, erased } of pseudonymised) {
    if (erased === null && column.notNull) {
      throw new NotNullablePersonalColumnError(getTableConfig(declaration.table).name, column.name);
    }
  }

  return pseudonymised;
}

/** A row is reached while one personal column still holds something: a text other than the marker, any other value, a file. */
function notYetErased(pseudonymised: readonly Pseudonymised[]): SQL {
  return sql.join(
    pseudonymised.map(({ column, erased }) =>
      erased === null
        ? sql`${named(column)} is not null`
        : sql`(${named(column)} is not null and ${named(column)} <> ${ERASED_PERSONAL_DATA})`,
    ),
    sql` or `,
  );
}

function assertFilesReachable({ declarations, files }: DrizzlePersonalDataErasureOptions): void {
  const naming = declarations.find((declaration) => declaration.files.length > 0);

  if (naming !== undefined && files === undefined) {
    throw new Error(
      `The declaration of ${getTableConfig(naming.table).name} names file columns (${naming.files.join(', ')}) and no file storage was given: the files of an erased person would stay in the storage`,
    );
  }
}
