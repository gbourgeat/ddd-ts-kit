import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import type { ReadModelTablesUnderContract } from './read-model/read-model-tables-under-contract';
import { TableAgreementSuite } from './read-model/table-agreement-suite';
import { TableDoubtsSuite } from './read-model/table-doubts-suite';
import { TableMigrationSuite } from './read-model/table-migration-suite';
import { TablesAtStartSuite } from './read-model/tables-at-start-suite';

export interface ReadModelTablesContractOptions {
  readonly name: string;
  /** The read model table of the package and a way to run a statement, on a PostgreSQL database; called before each test. */
  createTables(): Awaitable<ReadModelTablesUnderContract>;
  /** True where a store names the column of its tenant: a table that keeps it under another name is then read too. */
  readonly tenantColumn?: boolean;
  /** True where the definition of a table names the columns of its stamp. */
  readonly renamedStamps?: boolean;
  /** True where a table has a definition that says which columns refuse NULL, read when the store is built. */
  readonly definition?: boolean;
}

/**
 * What the read model table of every ORM package guarantees of the trace of a deleted row, on
 * PostgreSQL: what `ReadModelTables` says of the tables an application lists is, table by table,
 * what the store of each says before its first trace, the same state from the same reading, and a
 * table it finds ready takes a trace; the verdict follows the columns the store maps, whatever
 * else the table holds (a key that is not the primary key, a tenant column, a column the database
 * fills), and names what no migration opens (a part of the primary key, an identity or a
 * generated column, a table that is not there); the migration a refusal writes, run as it is and
 * run twice, makes the table ready and touches nothing the store does not map; its validation
 * scans without the lock that stops readers; a constraint of the kit's name written otherwise is
 * read as another check and never dropped; another check on a field of the row and a view are
 * warnings; a table that cannot be read is told under its name, the others still read; a table
 * nobody lists is never read; the start of an application is refused, or told as an error.
 */
export function readModelTablesContract(runner: ContractRunner, options: ReadModelTablesContractOptions): void {
  const createTables = (): Awaitable<ReadModelTablesUnderContract> => options.createTables();
  const named = `${options.name} (read model tables contract`;

  new TableAgreementSuite(runner, createTables, options).describe(`${named}: the list and the store)`);
  new TableMigrationSuite(runner, createTables).describe(`${named}: the migration)`);
  new TableDoubtsSuite(runner, createTables).describe(`${named}: what the check does not decide)`);
  new TablesAtStartSuite(runner, createTables).describe(`${named}: the start)`);
}
