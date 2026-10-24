import { ERASED_PERSONAL_DATA } from '../../application/event-sourcing/erased-personal-data';
import type { PersonalDataRecord } from '../../application/personal-data/personal-data-record';
import { personalDataValueOf } from '../../application/personal-data/personal-data-value-of';
import type { PersonalFields } from '../../application/personal-data/personal-fields';
import type { FileStorage } from '../../application/ports/file-storage';
import type { PersonalDataErasure } from '../../application/ports/personal-data-erasure';
import type { PersonalDataExport } from '../../application/ports/personal-data-export';

export interface InMemoryPersonalDataOptions {
  /** Where the files the declaration names live: deleted by an erasure. Left out, their columns are emptied alone. */
  readonly files?: FileStorage;
}

/**
 * The reference implementation of an erasure and of an export over one declaration of personal
 * fields: the rows of one table, held in memory. What every adapter of a persistence package does
 * on its rows, this does on a list, and both pass `personalDataErasureContract` and
 * `personalDataExportContract` of `@ddd-ts-kit/testing`. For tests, and for a context whose copy
 * lives in memory.
 */
export class InMemoryPersonalData<R extends object> implements PersonalDataErasure, PersonalDataExport {
  private rows: R[] = [];

  constructor(
    readonly name: string,
    private readonly declaration: PersonalFields<R>,
    private readonly options: InMemoryPersonalDataOptions = {},
  ) {}

  /** What the table holds, as a repository or a projection would have written it. */
  insert(...rows: readonly R[]): void {
    this.rows.push(...rows);
  }

  all(): readonly R[] {
    return [...this.rows];
  }

  async erase(subject: string): Promise<number> {
    const reached = this.rows.filter((row) => this.isAbout(row, subject) && !this.isErased(row));

    for (const row of reached) {
      await this.deleteFilesOf(row);
    }

    this.rows =
      this.declaration.erasure === 'row'
        ? this.rows.filter((row) => !reached.includes(row))
        : this.rows.map((row) => (reached.includes(row) ? this.pseudonymised(row) : row));

    return reached.length;
  }

  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    const { fields, files } = this.declaration;

    return this.rows
      .filter((row) => this.isAbout(row, subject))
      .map((row) => ({
        source: this.name,
        values: Object.fromEntries(
          [...fields, ...files].map((field) => [field, personalDataValueOf(columnOf(row, field))]),
        ),
      }));
  }

  private isAbout(row: R, subject: string): boolean {
    return columnOf(row, this.declaration.subject) === subject;
  }

  /** Pseudonymised already: every personal field reads erased or nothing, and no file is left. */
  private isErased(row: R): boolean {
    const { fields, files } = this.declaration;

    return (
      fields.every((field) => columnOf(row, field) === ERASED_PERSONAL_DATA || columnOf(row, field) === null) &&
      files.every((file) => columnOf(row, file) === null)
    );
  }

  private async deleteFilesOf(row: R): Promise<void> {
    for (const column of this.declaration.files) {
      const key = columnOf(row, column);

      if (typeof key === 'string' && this.options.files !== undefined) {
        await this.options.files.delete(key);
      }
    }
  }

  private pseudonymised(row: R): R {
    const { fields, files } = this.declaration;

    const erased: [string, unknown][] = [
      ...fields.map((field): [string, unknown] => [
        field,
        typeof row[field] === 'string' ? ERASED_PERSONAL_DATA : null,
      ]),
      ...files.map((file): [string, unknown] => [file, null]),
    ];

    return { ...row, ...Object.fromEntries(erased) };
  }
}

/** The value of one column of a row, whatever the type of the row: read, never asserted. */
function columnOf(row: object, column: string): unknown {
  const value: unknown = Reflect.get(row, column);

  return value;
}
