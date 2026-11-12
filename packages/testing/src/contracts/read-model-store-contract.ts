import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { DeletionsSuite } from './read-model/deletions-suite';
import { RebuildSuite } from './read-model/rebuild-suite';
import type { ReadModelStoreUnderContract } from './read-model/read-model-store-under-contract';
import { RowsSuite } from './read-model/rows-suite';
import { WritesAtOnceSuite } from './read-model/writes-at-once-suite';

export interface ReadModelStoreContractOptions {
  readonly name: string;
  /** Called before each test. */
  createTable(): Awaitable<ReadModelStoreUnderContract>;
  /**
   * What the storage holds under a key, by field of the row (`{ id, status, startsAt... }`), read
   * beside the store, by a statement of your own: the contract checks that a deleted row keeps
   * its key and no data. Without it that case stays to do.
   */
  stored?(key: string): Awaitable<Readonly<Record<string, unknown>> | undefined>;
  /**
   * True when the storage holds `title` unique (a unique index on its column): the contract
   * checks that a deleted row frees its value, and that writers inserting one row at once are not
   * refused for it. Without it those cases stay to do.
   */
  readonly uniqueTitle?: boolean;
}

/**
 * What every adapter of `ReadModelTable` guarantees under `TableReadModelStore`, the
 * in-memory one included: rows that round trip, events applied once and in order whatever
 * the order of their delivery, deletions that last and leave no data, even of a key the table
 * does not hold yet, and a rebuild that loses no event.
 */
export function readModelStoreContract(runner: ContractRunner, options: ReadModelStoreContractOptions): void {
  const create = (): Awaitable<ReadModelStoreUnderContract> => options.createTable();

  new RowsSuite(runner, create).describe(`${options.name} (read model store contract: rows)`);
  new DeletionsSuite(runner, create, options).describe(`${options.name} (read model store contract: deletions)`);

  new WritesAtOnceSuite(runner, create, { ...options, rebuilt: true }).describe(
    `${options.name} (read model store contract: writes at once)`,
  );

  new RebuildSuite(runner, create).describe(`${options.name} (read model store contract: rebuild)`);
}
