import type { SqlRow } from './sql-row.js';
import type { Sql } from './statement.js';

/** Where a store runs its statements: the ambient transaction, or the database itself. */
export interface SqlSession {
  query(statement: Sql): Promise<readonly SqlRow[]>;

  /** A transaction of its own, or a savepoint when the session is already one. */
  transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T>;
}
