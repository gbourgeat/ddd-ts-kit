import type { SqlStatement } from './sql-statement.js';

/** One action of an `ALTER TABLE` that bears on a primary key, with the position of its statement in the file. */
export interface TableChange {
  readonly kind: 'add-key' | 'drop-constraint' | 'drop-column';
  /** Unquoted, without its schema; lower case unless it was quoted, as PostgreSQL reads it. */
  readonly table: string;
  /** The dropped constraint or column; empty for an added key. */
  readonly name: string;
  readonly position: number;
  readonly statement: SqlStatement;
}
