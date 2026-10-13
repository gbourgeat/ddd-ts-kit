import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import type { EventStoreUnderContract } from './event-store/event-store-under-contract.js';
import { OneTransactionSuite } from './event-store/one-transaction-suite.js';

export interface EventStoreUnitOfWorkContractOptions {
  readonly name: string;
  /** An empty event store and an empty outbox of one database, bound to one unit of work; called before each test. */
  createSubject(): Awaitable<EventStoreUnderContract>;
}

/**
 * No double write for an event-sourced aggregate: what its save appends to its stream and what the
 * publisher of its events writes to the outbox commit in one transaction, so nothing is published
 * for an append that was rolled back or refused. Held by every transactional event store.
 */
export function eventStoreUnitOfWorkContract(
  runner: ContractRunner,
  options: EventStoreUnitOfWorkContractOptions,
): void {
  new OneTransactionSuite(runner, () => options.createSubject()).describe(
    `${options.name} (event store contract: one transaction with the outbox)`,
  );
}
