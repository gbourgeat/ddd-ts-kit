import type { Knex } from 'knex';
import {
  ERASED_PERSONAL_DATA,
  NotADataSubjectIdError,
  NotNullablePersonalColumnError,
  isDataSubjectId,
  pseudonymisedValueOf,
  type PersonalDataErasure,
} from '@ddd-ts-kit/kernel';
import { tableIn } from '../tenancy/table-in';
import type { KnexContext } from '../unit-of-work/knex-context';
import type { KnexPersonalDataErasureOptions } from './knex-personal-data-erasure-options';
import type { KnexPersonalFields } from './knex-personal-fields';
import { recordsOf } from './records-of';
import { rowsAbout } from './rows-about';

type Changes = Readonly<Record<string, string | null>>;

/** What the catalogue says of a column: its SQL type, and whether it accepts null. */
interface Column {
  readonly type: string;
  readonly nullable: boolean;
}

/**
 * The erasure of a data subject from the tables a context declared with `personalFields`, on Knex:
 * the files the rows name are deleted from the storage first, then the rows of the subject are
 * deleted (`row`) or their personal columns pseudonymised (`pseudonymise`: a text reads
 * `ERASED_PERSONAL_DATA`, any other type nothing, a file column nothing). Every statement runs on
 * the executor of the unit of work and, for tenant data, in the tenant of the work alone. The port
 * of the context extends `PersonalDataErasure` and its adapter extends this class:
 * `class KnexPatientErasure extends KnexPersonalDataErasure implements PatientErasure`.
 */
export class KnexPersonalDataErasure implements PersonalDataErasure {
  readonly name: string;

  private readonly columns = new Map<string, Promise<Readonly<Record<string, Column>>>>();

  constructor(
    private readonly context: KnexContext,
    private readonly options: KnexPersonalDataErasureOptions,
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
      reached += await this.eraseIn(declaration, subject);
    }

    return reached;
  }

  /** What a pseudonymisation would write is settled, and refused, before any file or row is touched. */
  private async eraseIn(declaration: KnexPersonalFields, subject: string): Promise<number> {
    const changes = declaration.erasure === 'row' ? undefined : await this.changesOf(declaration);

    await this.deleteFilesOf(declaration, subject);

    const rows = rowsAbout(this.context, { declaration, subject }, this.options.tenant);

    return changes === undefined
      ? rows.delete()
      : rows.where((reached) => notYetErased(reached, changes)).update(changes);
  }

  /** The content first, then the reference: a row that still names a deleted file is run again, a file nothing names is lost. */
  private async deleteFilesOf(declaration: KnexPersonalFields, subject: string): Promise<void> {
    const { files } = declaration;
    const storage = this.options.files;

    if (files.length === 0 || storage === undefined) {
      return;
    }

    const rows: unknown = await rowsAbout(this.context, { declaration, subject }, this.options.tenant)
      .select(files)
      .where((named) => {
        for (const file of files) {
          void named.orWhereNotNull(file);
        }
      });

    for (const row of recordsOf(rows)) {
      for (const file of files) {
        const key = row[file];

        if (typeof key === 'string') {
          await storage.delete(key);
        }
      }
    }
  }

  /** Each personal column and what it reads once pseudonymised: the marker for a text, nothing for anything else or for a file, which the column has to accept. */
  private async changesOf(declaration: KnexPersonalFields): Promise<Changes> {
    const columns = await this.columnsOf(declaration);
    const table = `${declaration.table.schema ?? ''}.${declaration.table.table}`;

    const changes: Changes = Object.fromEntries([
      ...declaration.fields.map((field): [string, string | null] => [
        field,
        pseudonymisedValueOf(columns[field]?.type ?? ''),
      ]),
      ...declaration.files.map((file): [string, string | null] => [file, null]),
    ]);

    for (const [column, erased] of Object.entries(changes)) {
      if (erased === null && columns[column]?.nullable === false) {
        throw new NotNullablePersonalColumnError(table, column);
      }
    }

    return changes;
  }

  /** What the catalogue says of each column of the table, read once: a text is pseudonymised, anything else emptied. */
  private columnsOf({ table }: KnexPersonalFields): Promise<Readonly<Record<string, Column>>> {
    const name = `${table.schema ?? ''}.${table.table}`;
    const known = this.columns.get(name);

    if (known !== undefined) {
      return known;
    }

    const read = tableIn(this.context, table)
      .columnInfo()
      .then((columns: Readonly<Record<string, Knex.ColumnInfo>>) =>
        Object.fromEntries(
          Object.entries(columns).map(([column, info]) => [column, { type: info.type, nullable: info.nullable }]),
        ),
      );

    this.columns.set(name, read);

    return read;
  }
}

/** A row is reached while one personal column still holds something: a text other than the marker, any other value, a file. */
function notYetErased(reached: Knex.QueryBuilder, changes: Changes): void {
  for (const [column, erased] of Object.entries(changes)) {
    if (erased === null) {
      void reached.orWhereNotNull(column);
    } else {
      void reached.orWhere((text) => {
        void text.whereNotNull(column).whereNot(column, ERASED_PERSONAL_DATA);
      });
    }
  }
}

function assertFilesReachable({ declarations, files }: KnexPersonalDataErasureOptions): void {
  const naming = declarations.find((declaration) => declaration.files.length > 0);

  if (naming !== undefined && files === undefined) {
    throw new Error(
      `The declaration of ${naming.table.table} names file columns (${naming.files.join(', ')}) and no file storage was given: the files of an erased person would stay in the storage`,
    );
  }
}
