import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { DeletionsSuite } from './read-model/deletions-suite';
import type { ReadModelRowsUnderContract } from './read-model/read-model-rows-under-contract';
import { RowsSuite } from './read-model/rows-suite';
import { WritesAtOnceSuite } from './read-model/writes-at-once-suite';

export interface ReadModelRowsContractOptions {
  readonly name: string;
  /** Called before each test. */
  createTable(): Awaitable<ReadModelRowsUnderContract>;
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
 * The rows half of `readModelStoreContract`, for a store that has no rebuild yet: rows that
 * round trip, events applied once and in order whatever the order of their delivery, deletions
 * that last and leave no data, and searching. A store with a rebuild runs `readModelStoreContract`, which holds it.
 */
export function readModelRowsContract(runner: ContractRunner, options: ReadModelRowsContractOptions): void {
  const create = (): Awaitable<ReadModelRowsUnderContract> => options.createTable();

  new RowsSuite(runner, create).describe(`${options.name} (read model store contract: rows)`);
  new DeletionsSuite(runner, create, options).describe(`${options.name} (read model store contract: deletions)`);

  new WritesAtOnceSuite(runner, create, { ...options, rebuilt: false }).describe(
    `${options.name} (read model store contract: writes at once)`,
  );
}
