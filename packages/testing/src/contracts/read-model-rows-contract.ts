import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import type { ReadModelRowsUnderContract } from './read-model/read-model-rows-under-contract';
import { RowsSuite } from './read-model/rows-suite';

export interface ReadModelRowsContractOptions {
  readonly name: string;
  /** Called before each test. */
  createTable(): Awaitable<ReadModelRowsUnderContract>;
}

/**
 * The rows half of `readModelStoreContract`, for a store that has no rebuild yet: rows that
 * round trip, events applied once and in order whatever the order of their delivery, deletions
 * that last, and searching. A store with a rebuild runs `readModelStoreContract`, which holds it.
 */
export function readModelRowsContract(runner: ContractRunner, options: ReadModelRowsContractOptions): void {
  new RowsSuite(runner, () => options.createTable()).describe(`${options.name} (read model store contract: rows)`);
}
