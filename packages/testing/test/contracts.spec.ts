import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventBus, InMemoryProcessedEventStore } from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore } from '@ddd-ts-kit/events';
import { InMemoryRepository, resetSequences, snapshots } from '../src/index.js';
import {
  eventBusContract,
  outboxStoreContract,
  processedEventStoreContract,
  repositoryContract,
} from '../src/contracts.js';
import { anOrder } from './support/builders.js';
import { Order, at } from './support/order.js';

// The globals of the runner are passed as they are: the suites import no runner themselves.
const runner = { describe, it, expect, beforeEach, afterEach };

beforeEach(() => {
  resetSequences();
});

repositoryContract<Order>(runner, {
  name: 'InMemoryRepository with snapshots',
  createRepository: () =>
    new InMemoryRepository<Order>(
      snapshots({ toSnapshot: (order) => order.toSnapshot(), fromSnapshot: Order.rehydrate }),
    ),
  createAggregate: () => anOrder().build(),
  mutate: (order) => order.addLine({ sku: 'pen', quantity: 1 }, at),
  idOf: (order) => order.id,
  stateOf: (order) => order.toSnapshot(),
});

repositoryContract<Order>(runner, {
  name: 'InMemoryRepository with a clone function',
  createRepository: () =>
    new InMemoryRepository<Order>({ clone: (order) => Order.rehydrate(order.toSnapshot()) }),
  createAggregate: () => anOrder().build(),
  mutate: (order) => order.addLine({ sku: 'pen', quantity: 1 }, at),
  idOf: (order) => order.id,
  stateOf: (order) => order.toSnapshot(),
});

eventBusContract(runner, {
  name: 'InMemoryEventBus',
  createBus: () => ({ bus: new InMemoryEventBus() }),
});

// Without afterEach, as under a runner that would not provide it.
eventBusContract(
  { describe, it, expect, beforeEach },
  {
    name: 'InMemoryEventBus with a settle hook',
    createBus: async () => ({
      bus: new InMemoryEventBus(),
      settle: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    }),
  },
);

outboxStoreContract(runner, {
  name: 'InMemoryOutboxStore',
  leaseMs: 30_000,
  createStore: () => new InMemoryOutboxStore({ leaseMs: 30_000 }),
});

processedEventStoreContract(runner, {
  name: 'InMemoryProcessedEventStore',
  createStore: () => new InMemoryProcessedEventStore(),
});
