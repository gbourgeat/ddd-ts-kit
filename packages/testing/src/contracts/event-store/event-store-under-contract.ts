import type { EventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { OutboxStoreUnderContract } from '../outbox-store-contract';

/** An event store and the outbox of the same database, both bound to one unit of work, all empty. */
export interface EventStoreUnderContract {
  readonly unitOfWork: UnitOfWork;
  readonly store: EventStore;
  readonly outbox: Pick<OutboxStoreUnderContract, 'append' | 'claimBatch' | 'stats'>;
  close?(): Awaitable<void>;
}
