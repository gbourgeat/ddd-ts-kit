import {
  NotADataSubjectIdError,
  isDataSubjectId,
  personalDataValueOf,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context';
import type { KnexPersonalDataExportOptions } from './knex-personal-data-export-options';
import type { KnexPersonalFields } from './knex-personal-fields';
import { recordsOf } from './records-of';
import { rowsAbout } from './rows-about';

/**
 * The export of what a context keeps of a data subject, on Knex: for every table declared with
 * `personalFields`, one record per row about the subject, under `<name>.<table>`, holding each
 * personal column and each file column (by its key) as plain data, nothing of anyone else and no
 * other column. A row erased already answers what it reads, `[erased]` or nothing. Every statement
 * runs on the executor of the unit of work and, for tenant data, in the tenant of the work alone.
 * The port of the context extends `PersonalDataExport` and its adapter extends this class:
 * `class KnexPatientExport extends KnexPersonalDataExport implements PatientExport`.
 */
export class KnexPersonalDataExport implements PersonalDataExport {
  readonly name: string;

  constructor(
    private readonly context: KnexContext,
    private readonly options: KnexPersonalDataExportOptions,
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

  private async recordsIn(declaration: KnexPersonalFields, subject: string): Promise<PersonalDataRecord[]> {
    const columns = [...declaration.fields, ...declaration.files];
    const rows: unknown = await rowsAbout(this.context, { declaration, subject }, this.options.tenant).select(columns);
    const source = `${this.name}.${declaration.table.table}`;

    return recordsOf(rows).map((row) => ({
      source,
      values: Object.fromEntries(columns.map((column) => [column, personalDataValueOf(row[column])])),
    }));
  }
}
