import { getTableColumns, sql, type TablesRelationalConfig } from 'drizzle-orm';
import { getTableConfig, type PgColumn, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  NotADataSubjectIdError,
  isDataSubjectId,
  personalDataValueOf,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import { columnOf } from '../read-model/column-of';
import { rowsOf } from '../read-model/rows-of';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';
import { aboutSubject } from './about-subject';
import type { DrizzlePersonalDataExportOptions } from './drizzle-personal-data-export-options';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';
import { named } from './named';
import { tableSqlOf } from './table-sql-of';

const COMMA = sql`, `;

/**
 * The export of what a context keeps of a data subject, on Drizzle: for every table declared with
 * `personalFields`, one record per row about the subject, under `<name>.<table>`, holding each
 * personal column and each file column (by its key) as plain data, by the keys of the definition,
 * nothing of anyone else and no other column. A row erased already answers what it reads,
 * `[erased]` or nothing. Every statement runs on the executor of the unit of work and, for tenant
 * data, in the tenant of the work alone. The port of the context extends `PersonalDataExport` and its
 * adapter extends this class:
 * `class DrizzlePatientExport extends DrizzlePersonalDataExport<NodePgQueryResultHKT> implements PatientExport`.
 */
export class DrizzlePersonalDataExport<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = TablesRelationalConfig,
> implements PersonalDataExport
{
  readonly name: string;

  constructor(
    private readonly context: DrizzleContext<Q, F, S>,
    private readonly options: DrizzlePersonalDataExportOptions,
  ) {
    this.name = options.name;
  }

  /** The records about the subject in every declared table, in the order the store answers them. A subject that is not an opaque id is refused before any statement. */
  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    if (!isDataSubjectId(subject)) {
      throw new NotADataSubjectIdError();
    }

    const records: PersonalDataRecord[] = [];

    for (const declaration of this.options.declarations) {
      records.push(...(await this.recordsIn(declaration, subject)));
    }

    return records;
  }

  private async recordsIn(declaration: DrizzlePersonalFields, subject: string): Promise<PersonalDataRecord[]> {
    const exported = exportedColumnsOf(declaration);
    const names = exported.map(({ column }) => named(column));
    const selected = sql.join(names, COMMA);
    const about = aboutSubject(declaration, subject, this.options.tenant);
    const statement = sql`select ${selected} from ${tableSqlOf(declaration)} where ${about}`;
    const answered = await this.context.executor().execute(statement);
    const source = `${this.name}.${getTableConfig(declaration.table).name}`;

    return rowsOf(answered).map((row) => ({
      source,
      values: Object.fromEntries(exported.map(({ field, column }) => [field, personalDataValueOf(row[column.name])])),
    }));
  }
}

/** The declared columns of a table, each under the key of the definition the record names it by. */
function exportedColumnsOf(declaration: DrizzlePersonalFields): { field: string; column: PgColumn }[] {
  const columns = getTableColumns(declaration.table);

  return [...declaration.fields, ...declaration.files].map((field) => ({ field, column: columnOf(columns, field) }));
}
