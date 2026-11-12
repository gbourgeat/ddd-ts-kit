import { ReadModelTableNotReadyError } from './read-model-table-not-ready-error';
import type { UnreadyReadModelTable } from './unready-read-model-table';

/**
 * Read model tables of the database cannot hold the trace of a deleted row: every one of them, in
 * one error, each with its columns and the migration to write. Raised when the tables are checked
 * in one pass, at the start of an application or before a deployment, where
 * `ReadModelTableNotReadyError` is the refusal of one store before its first trace.
 */
export class ReadModelTablesNotReadyError extends Error {
  readonly tables: readonly ReadModelTableNotReadyError[];

  constructor(unready: readonly UnreadyReadModelTable[]) {
    const tables = unready.map((table) => new ReadModelTableNotReadyError(table));
    const counted = tables.length === 1 ? '1 read model table is' : `${String(tables.length)} read model tables are`;

    super(
      `${counted} not ready for this version: ${tables.map(({ table }) => table).join(', ')}. Apply the migrations of the project before the application starts; a table they leave as it is takes the migration written under its name.\n\n${tables.map(({ message }) => message).join('\n\n')}`,
    );

    this.name = 'ReadModelTablesNotReadyError';
    this.tables = tables;
  }
}
