import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  InMemoryCache,
  InMemoryEventBus,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemorySnapshotStore,
  InMemorySubjectKeyStore,
  InMemoryLock,
  InMemoryProcessedEventStore,
  InMemoryRateLimiter,
  InMemoryReadModelTable,
  InMemoryUnitOfWork,
  evaluateCriteria,
} from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore } from '@ddd-ts-kit/events';
import { InMemoryRepository, resetSequences, snapshots } from '../src/index.js';
import {
  cacheContract,
  criteriaContract,
  criteriaContractDefinition,
  eventBusContract,
  eventStoreContract,
  eventStoreUnitOfWorkContract,
  lockContract,
  outboxStoreContract,
  processedEventStoreContract,
  rateLimiterContract,
  readModelStoreContract,
  repositoryContract,
  type CriteriaContractRow,
} from '../src/contracts.js';
import { anOrder } from './support/builders.js';
import { Order, at } from './support/order.js';
import { TransactionalJournal } from './support/transactional-journal.js';

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
  createRepository: () => new InMemoryRepository<Order>({ clone: (order) => Order.rehydrate(order.toSnapshot()) }),
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

eventStoreContract(runner, {
  name: 'InMemoryEventStore',
  createStore: () => new InMemoryEventStore(),
  createCompanions: () => ({
    snapshots: new InMemorySnapshotStore(),
    checkpoints: new InMemoryCheckpointStore(),
    subjectKeys: new InMemorySubjectKeyStore(),
  }),
});

eventStoreUnitOfWorkContract(runner, {
  name: 'an event store and an outbox in memory with transactions',
  createSubject: () => new TransactionalJournal(),
});

processedEventStoreContract(runner, {
  name: 'InMemoryProcessedEventStore',
  createStore: () => new InMemoryProcessedEventStore(),
});

const NOW = new Date('2026-03-01T10:00:00.000Z');
let clock: FixedClock;

const aClock = () => {
  clock = new FixedClock(NOW);

  return clock;
};

const elapse = (ms: number) => clock.advance(ms);

cacheContract(runner, { name: 'InMemoryCache', createCache: () => new InMemoryCache(aClock()), elapse });

lockContract(runner, { name: 'InMemoryLock', createLock: () => new InMemoryLock(aClock()), elapse });

rateLimiterContract(runner, {
  name: 'InMemoryRateLimiter',
  createLimiter: () => new InMemoryRateLimiter(aClock()),
  elapse,
});

criteriaContract(runner, {
  name: 'evaluateCriteria',
  createReadModel: (rows) => ({
    search: async (criteria) => evaluateCriteria(criteriaContractDefinition, rows, criteria),
  }),
});

readModelStoreContract(runner, {
  name: 'InMemoryReadModelTable',
  createTable: () => ({
    table: new InMemoryReadModelTable<CriteriaContractRow>(),
    unitOfWork: new InMemoryUnitOfWork(),
  }),
});
