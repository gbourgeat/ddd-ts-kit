import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { RebuildSuite } from './read-model/rebuild-suite';
import type { ReadModelStoreUnderContract } from './read-model/read-model-store-under-contract';
import { RowsSuite } from './read-model/rows-suite';

export interface ReadModelStoreContractOptions {
  readonly name: string;
  /** Called before each test. */
  createTable(): Awaitable<ReadModelStoreUnderContract>;
}

/**
 * What every adapter of `ReadModelTable` guarantees under `TableReadModelStore`, the
 * in-memory one included: rows that round trip, events applied once and in order whatever
 * the order of their delivery, deletions that last, and a rebuild that loses no event.
 */
export function readModelStoreContract(runner: ContractRunner, options: ReadModelStoreContractOptions): void {
  const create = (): Awaitable<ReadModelStoreUnderContract> => options.createTable();

  new RowsSuite(runner, create).describe(`${options.name} (read model store contract: rows)`);
  new RebuildSuite(runner, create).describe(`${options.name} (read model store contract: rebuild)`);
}
