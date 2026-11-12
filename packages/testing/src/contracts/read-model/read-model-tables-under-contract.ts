import type { PostgresReadModelTables, ReadModelTablesOptions } from '@ddd-ts-kit/kernel';

/** What the contract checks the read model tables of a database through: the function of an ORM package, on one database. */
export interface ReadModelTablesUnderContract {
  /** `knexReadModelTables(context, options)`, and the same of each ORM package. */
  tables(options?: ReadModelTablesOptions): PostgresReadModelTables;
  /** Runs one statement beside the check, as a migration would: the contract creates and alters its own tables. */
  execute(statement: string): Promise<unknown>;
}
