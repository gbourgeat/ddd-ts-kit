import {
  NotADataSubjectIdError,
  isDataSubjectId,
  personalDataValueOf,
  type PersonalDataExport,
  type PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import { aboutSubject } from './about-subject';
import type { TypeOrmPersonalDataExportOptions } from './type-orm-personal-data-export-options';
import type { TypeOrmPersonalFields } from './type-orm-personal-fields';

/**
 * The export of what a context keeps of a data subject, on TypeORM: for every entity declared with
 * `personalFields`, one record per row about the subject, under `<name>.<table>`, holding each
 * personal property and each file property (by its key) as plain data, nothing of anyone else and no
 * other column. A row erased already answers what it reads, `[erased]` or nothing. Every statement
 * runs on the entity manager of the unit of work and, for tenant data, in the tenant of the work
 * alone. The port of the context extends `PersonalDataExport` and its adapter extends this class:
 * `class TypeOrmPatientExport extends TypeOrmPersonalDataExport implements PatientExport`.
 */
export class TypeOrmPersonalDataExport implements PersonalDataExport {
  readonly name: string;

  constructor(
    private readonly context: TypeOrmContext,
    private readonly options: TypeOrmPersonalDataExportOptions,
  ) {
    this.name = options.name;
  }

  /** The records about the subject in every declared entity, in the order the store answers them. A subject that is not an opaque id is refused before any statement. */
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

  private async recordsIn(declaration: TypeOrmPersonalFields, subject: string): Promise<PersonalDataRecord[]> {
    const properties = [...declaration.fields, ...declaration.files];

    const rows: readonly Readonly<Record<string, unknown>>[] = await this.context
      .manager()
      .getRepository(declaration.table)
      .find({
        select: Object.fromEntries(properties.map((property) => [property, true])),
        where: aboutSubject(declaration, subject, this.options.tenant),
      });

    const source = `${this.name}.${this.context.manager().dataSource.getMetadata(declaration.table).tableName}`;

    return rows.map((row) => ({
      source,
      values: Object.fromEntries(properties.map((property) => [property, personalDataValueOf(row[property])])),
    }));
  }
}
