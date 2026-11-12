import { ReadModelTableNotReadyError } from './read-model-table-not-ready-error';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';

/** A listed read model whose table could not be read: its store could not be built, or the database refused the reading. */
interface UnreadReadModel {
  /** The name the list gives the read model: the class of its store. */
  readonly name: string;
  readonly cause: unknown;
}

/**
 * Read model tables the application lists cannot hold the trace of a deleted row, or could not be
 * read: every one of them, in one error, each table with what keeps it from it and the migration
 * to write, each unread one under its name with what failed. Raised when the tables are checked
 * in one pass, at the start of an application or before a deployment, where
 * `ReadModelTableNotReadyError` is the refusal of one store before its first trace. Each entry of
 * `tables` is that very refusal: the verdict and the migration are the ones the store would give.
 */
export class ReadModelTablesNotReadyError extends Error {
  readonly tables: readonly ReadModelTableNotReadyError[];

  constructor(
    unready: readonly ReadModelTableState[],
    readonly unread: readonly UnreadReadModel[] = [],
  ) {
    const tables = unready.map((table) => new ReadModelTableNotReadyError(table));

    super([...notReady(tables), ...notRead(unread), ...tables.map(({ message }) => message)].join('\n\n'));

    this.name = 'ReadModelTablesNotReadyError';
    this.tables = tables;
  }
}

function notReady(tables: readonly ReadModelTableNotReadyError[]): string[] {
  if (tables.length === 0) {
    return [];
  }

  const counted = tables.length === 1 ? '1 read model table is' : `${String(tables.length)} read model tables are`;

  return [
    `${counted} not ready for this version: ${tables.map(({ table }) => table).join(', ')}. Apply the migrations of the project before the application starts; a table they leave as it is takes the migration written under its name.`,
  ];
}

function notRead(unread: readonly UnreadReadModel[]): string[] {
  if (unread.length === 0) {
    return [];
  }

  const counted =
    unread.length === 1 ? 'The table of 1 read model' : `The tables of ${String(unread.length)} read models`;

  const each = unread.map(({ name, cause }) => `${name} (${cause instanceof Error ? cause.message : String(cause)})`);

  return [`${counted} could not be read, so nothing says whether a trace is taken: ${each.join('; ')}.`];
}
