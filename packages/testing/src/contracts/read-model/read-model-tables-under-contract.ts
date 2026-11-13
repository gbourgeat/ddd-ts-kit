import type { ReadModelTable } from '@ddd-ts-kit/kernel';
import type { ReadModelTableShape } from './read-model-table-shape';

/** What the contract reads the tables of a database through: the read model table of an ORM package, on one database. */
export interface ReadModelTablesUnderContract {
  /**
   * The read model table of the package over a table of the schema of the contract, built as an
   * application builds it: `new KnexReadModelTable(context, options)`. Its work runs for the
   * tenant `acme`. It may refuse when it is built, as a definition that refuses NULL does.
   */
  table(shape: ReadModelTableShape): ReadModelTable<Record<string, string | null>>;
  /** Runs one statement beside the tables, as a migration would, in the transaction in progress if any, and answers its rows. */
  execute(statement: string): Promise<readonly Readonly<Record<string, unknown>>[]>;
  /** Runs `work` in one transaction: what `execute` runs meanwhile holds its locks until it ends. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
