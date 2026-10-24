import {
  NotADataSubjectIdError,
  isDataSubjectId,
  personalDataValueOf,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import { aboutSubject } from './about-subject';
import { pathOf } from './path-of';
import type { PrismaPersonalDataExportOptions } from './prisma-personal-data-export-options';
import type { PrismaPersonalFields } from './prisma-personal-fields';
import { quoted } from './quoted';
import { rawRows } from './raw-rows';

/**
 * The export of what a context keeps of a data subject, on Prisma: for every table declared with
 * `personalFields`, one record per row about the subject, under `<name>.<table>`, holding each
 * personal column and each file column (by its key) as plain data, by their SQL names, nothing of
 * anyone else and no other column. A row erased already answers what it reads, `[erased]` or
 * nothing. Prisma builds no statement on a column it does not know at build time, so the statement
 * is written here, on PostgreSQL, with quoted identifiers from the declaration and every value a
 * `$n` parameter; it runs on the client of the unit of work and, for tenant data, in the tenant of
 * the work alone. The port of the context extends `PersonalDataExport` and its adapter extends this
 * class: `class PrismaPatientExport extends PrismaPersonalDataExport<Prisma.TransactionClient> implements PatientExport`.
 */
export class PrismaPersonalDataExport<Tx extends PrismaRawQueries> implements PersonalDataExport {
  readonly name: string;

  constructor(
    private readonly context: PrismaContext<Tx>,
    private readonly options: PrismaPersonalDataExportOptions,
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

  private async recordsIn(declaration: PrismaPersonalFields, subject: string): Promise<PersonalDataRecord[]> {
    const columns = [...declaration.fields, ...declaration.files];
    const about = aboutSubject(declaration, subject, this.options.tenant);

    const rows = await rawRows(
      this.context.client(),
      `select ${columns.map(quoted).join(', ')} from ${pathOf(declaration)} where ${about.text}`,
      about.values,
    );

    const source = `${this.name}.${declaration.table.table}`;

    return rows.map((row) => ({
      source,
      values: Object.fromEntries(columns.map((column) => [column, personalDataValueOf(row[column])])),
    }));
  }
}
