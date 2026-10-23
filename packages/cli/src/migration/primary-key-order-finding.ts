import type { SqlStatement } from './sql-statement';

/** Two statements of one migration that change a primary key in an order PostgreSQL refuses. */
export interface PrimaryKeyOrderFinding {
  readonly table: string;
  /** The statement that runs too early. */
  readonly early: SqlStatement;
  /** The statement that drops the old key, which has to run before it. */
  readonly drop: SqlStatement;
  readonly message: string;
  readonly fix: string;
}
