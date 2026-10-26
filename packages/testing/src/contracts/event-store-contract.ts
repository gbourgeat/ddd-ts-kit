import type { EventSourcingStores, EventStore } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { CompanionStoresSuite } from './event-store/companion-stores-suite';
import { StoreSuite } from './event-store/store-suite';
import { StreamSuite } from './event-store/stream-suite';
import { TenantSuite, type TenantEventStore } from './event-store/tenant-suite';

export interface EventStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<EventStore>;
  /** The snapshot, checkpoint and key stores that come with it, fresh and empty; their suite runs when given. */
  /**
   * A fresh, empty store reading its tenant from the scope it is returned with, on the same
   * database as `createStore`; its suite runs when given. A store that keeps no tenant leaves it out.
   */
  readonly createTenantStore?: () => Awaitable<TenantEventStore>;
  readonly createCompanions?: () => Awaitable<Pick<EventSourcingStores, 'snapshots' | 'checkpoints' | 'subjectKeys'>>;
}

/**
 * What every adapter of the kernel `EventStore` port guarantees, the in-memory one included:
 * an append at the version the stream still has, a concurrency conflict otherwise and nothing
 * kept of it, each stream in its order, the whole store in the order of the appends with a
 * position, and a read from a position. With `createCompanions`, the stores that come with it:
 * snapshots never replaced by an older one, checkpoints moved from where they stand, keys of data
 * subjects destroyed by an erasure. With `createTenantStore`, tenant isolation: a stream belongs
 * to the tenant of its first append, another tenant can neither read nor extend it, elevated staff
 * can read it, and the whole store tells the tenant of each event.
 */
export function eventStoreContract(runner: ContractRunner, options: EventStoreContractOptions): void {
  const create = (): Awaitable<EventStore> => options.createStore();

  new StreamSuite(runner, create).describe(`${options.name} (event store contract: streams)`);
  new StoreSuite(runner, create).describe(`${options.name} (event store contract: the whole store)`);

  const { createCompanions, createTenantStore } = options;

  if (createTenantStore !== undefined) {
    new TenantSuite(runner, () => createTenantStore()).describe(`${options.name} (event store contract: tenants)`);
  }

  if (createCompanions !== undefined) {
    new CompanionStoresSuite(runner, () => createCompanions()).describe(
      `${options.name} (event store contract: snapshots, checkpoints, keys)`,
    );
  }
}
