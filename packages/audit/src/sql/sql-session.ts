import type { SqlRow } from './sql-row.js';
import type { Sql } from './sql.js';

/** Where a store runs its statements: the ambient transaction, or the database itself. */
export interface SqlSession {
  /** The transaction the statements run in, the same object from its begin to its end; none on the database. */
  readonly ambientTransaction: object | undefined;

  query(statement: Sql): Promise<readonly SqlRow[]>;

  /** A transaction of its own, or a savepoint when the session is already one. */
  transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T>;
}
