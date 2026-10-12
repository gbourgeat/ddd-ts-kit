import type { EventStore } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { StoreSuite } from './event-store/store-suite.js';
import { StreamSuite } from './event-store/stream-suite.js';

export interface EventStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<EventStore>;
}

/**
 * What every adapter of the kernel `EventStore` port guarantees, the in-memory one included:
 * an append at the version the stream still has, a concurrency conflict otherwise and nothing
 * kept of it, each stream in its order, the whole store in the order of the appends with a
 * position, and a read from a position.
 */
export function eventStoreContract(runner: ContractRunner, options: EventStoreContractOptions): void {
  const create = (): Awaitable<EventStore> => options.createStore();

  new StreamSuite(runner, create).describe(`${options.name} (event store contract: streams)`);
  new StoreSuite(runner, create).describe(`${options.name} (event store contract: the whole store)`);
}
