import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  InMemoryCachePurger,
  InMemoryDomainEventDispatcher,
  InMemoryEventBus,
  PublishedCacheInvalidation,
  PurgingPublisher,
  SequentialIdGenerator,
  announceDomainEvents,
  cacheTag,
  unitOfWorkStage,
  type DomainEvent,
} from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import { KnexOutboxStore, createKnexUnitOfWork, createOutboxTables } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import { Invoice } from './support/billing-core/domain/invoice';
import { BILLING } from './support/billing-core/infrastructure/persistence/billing-schema';
import { createInvoicesTable } from './support/billing-core/infrastructure/persistence/create-invoices-table';
import { KnexInvoiceRepository } from './support/billing-core/infrastructure/persistence/knex-invoice.repository';
import { ada, scopeOf } from './support/scopes';

const now = new Date('2026-03-01T10:00:00.000Z');
const INVOICE = cacheTag('invoice', 'inv-1');

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createInvoicesTable(knex);
      await createOutboxTables(knex);
    },
    [`${BILLING}.invoices`, 'outbox', 'processed_events'],
  );
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.truncate();
});

/** One process of the application: its unit of work, the invalidation of its use cases, a repository. */
function aProcess() {
  const unitOfWork = createKnexUnitOfWork(database.knex);
  const store = new KnexOutboxStore(unitOfWork);
  const clock = new FixedClock(now);

  return {
    unitOfWork,
    store,
    repository: new KnexInvoiceRepository(unitOfWork, scopeOf(ada), clock),
    invalidation: new PublishedCacheInvalidation({
      publisher: new OutboxPublisher(store),
      ids: new SequentialIdGenerator(`purge-${Math.random()}`),
      clock,
      scope: new FixedExecutionScope(),
    }),
  };
}

/** The relay of a process started later: what it purges, and the events it hands the broker. */
async function relayOfANewProcess(): Promise<{ purger: InMemoryCachePurger; broker: InMemoryEventBus }> {
  const { store } = aProcess();
  const purger = new InMemoryCachePurger();
  const broker = new InMemoryEventBus();

  await new OutboxRelay({ store, publisher: new PurgingPublisher(purger, broker), clock: new FixedClock(now) }).tick();

  return { purger, broker };
}

class PaymentProviderDown extends Error {}

describe('a purge asked by a use case, through the outbox', () => {
  it('purges nothing when the work rolls back', async () => {
    const { unitOfWork, repository, invalidation } = aProcess();

    const failing = unitOfWork.run(async () => {
      await repository.save(Invoice.draft('inv-1', 100));
      await invalidation.invalidate([INVOICE]);
      throw new PaymentProviderDown();
    });

    await expect(failing).rejects.toBeInstanceOf(PaymentProviderDown);

    const { purger } = await relayOfANewProcess();

    expect(purger.purged).toEqual([]);
    expect(await database.knex('outbox')).toEqual([]);
  });

  it('purges nothing when a later reaction fails before the commit, after the event asked for the purge', async () => {
    const { unitOfWork, repository, invalidation } = aProcess();
    const drafted: DomainEvent = { name: 'billing.invoice.drafted', aggregateId: 'inv-1', occurredAt: now };
    const domainEvents = new InMemoryDomainEventDispatcher();
    const asked: string[] = [];

    const purgeTheInvoice = async (): Promise<void> => {
      await invalidation.invalidate([INVOICE]);
      asked.push(unitOfWorkStage());
    };

    const chargeTheCustomer = async (): Promise<void> => {
      throw new PaymentProviderDown();
    };

    domainEvents.on(drafted.name, purgeTheInvoice, { phase: 'before-commit' });
    domainEvents.on(drafted.name, chargeTheCustomer, { phase: 'before-commit' });

    const failing = unitOfWork.run(async () => {
      await repository.save(Invoice.draft('inv-1', 100));
      await announceDomainEvents([drafted], domainEvents);
    });

    await expect(failing).rejects.toBeInstanceOf(PaymentProviderDown);
    expect(asked).toEqual(['before-commit']);

    const { purger } = await relayOfANewProcess();

    expect(purger.purged).toEqual([]);
    expect(await database.knex('outbox')).toEqual([]);
  });

  it('purges once the work committed, even when the process that committed stopped before its relay ran', async () => {
    const committing = aProcess();

    await committing.unitOfWork.run(async () => {
      await committing.repository.save(Invoice.draft('inv-1', 100));
      await committing.invalidation.invalidate([INVOICE]);
    });

    // The committing process stops here: its relay never ran. Another one starts on the same database.
    const { purger, broker } = await relayOfANewProcess();

    expect(purger.purged).toEqual([INVOICE]);
    expect(broker.published).toEqual([]);
    expect(await committing.store.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
    expect((await committing.repository.findById('inv-1'))?.state.amount).toBe(100);
  });
});
