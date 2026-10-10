import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, InMemoryEventBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import { KnexOutboxStore, KnexProcessedEventStore, createKnexUnitOfWork, createOutboxTables } from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';
import { Invoice } from './support/billing-core/domain/invoice.js';
import { BILLING } from './support/billing-core/infrastructure/persistence/billing-schema.js';
import { createInvoicesTable } from './support/billing-core/infrastructure/persistence/create-invoices-table.js';
import { KnexInvoiceRepository } from './support/billing-core/infrastructure/persistence/knex-invoice.repository.js';
import { ada, scopeOf } from './support/scopes.js';

const now = new Date('2026-03-01T10:00:00.000Z');

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

const issued = (invoiceId: string): IntegrationEvent => ({
  id: `evt-${invoiceId}`,
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { invoiceId },
});

/** The wiring of a composition root. */
const wire = () => {
  const unitOfWork = createKnexUnitOfWork(database.knex);
  const store = new KnexOutboxStore(unitOfWork);

  return {
    unitOfWork,
    store,
    repository: new KnexInvoiceRepository(unitOfWork, scopeOf(ada), new FixedClock(now)),
    publisher: new OutboxPublisher(store),
    processed: new KnexProcessedEventStore(unitOfWork),
  };
};

const invoiceIds = async (): Promise<string[]> =>
  database.knex('invoices').withSchema(BILLING).orderBy('id').pluck('id');

class PaymentProviderDown extends Error {}

describe('createKnexUnitOfWork: one transaction for the write and the event', () => {
  it('commits the business write and the event together', async () => {
    const { unitOfWork, repository, publisher, store } = wire();

    const result = await unitOfWork.run(async () => {
      await repository.save(Invoice.draft('inv-1', 100));
      await publisher.publish([issued('inv-1')]);

      return 'done';
    });

    expect(result).toBe('done');
    expect((await repository.findById('inv-1'))?.state.amount).toBe(100);
    expect(await store.stats()).toEqual({ pending: 1, failed: 0, dead: 0 });
  });

  it('rolls back the event with the business write when the work throws', async () => {
    const { unitOfWork, repository, publisher, store } = wire();

    const failing = unitOfWork.run(async () => {
      await repository.save(Invoice.draft('inv-1', 100));
      await publisher.publish([issued('inv-1')]);
      throw new PaymentProviderDown();
    });

    await expect(failing).rejects.toBeInstanceOf(PaymentProviderDown);
    expect(await repository.findById('inv-1')).toBeUndefined();
    expect(await store.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
    expect(await database.knex('outbox')).toEqual([]);
  });

  it('rolls back the business write when the event cannot be stored', async () => {
    const { unitOfWork, repository, publisher } = wire();

    await publisher.publish([issued('inv-1')]);

    const failing = unitOfWork.run(async () => {
      await repository.save(Invoice.draft('inv-1', 100));
      await publisher.publish([issued('inv-1')]);
    });

    await expect(failing).rejects.toBeDefined();
    expect(await repository.findById('inv-1')).toBeUndefined();
  });
});

describe('the KnexContext of a unit of work', () => {
  it('gives the transaction inside run and the root instance outside', async () => {
    const { unitOfWork } = wire();

    expect(unitOfWork.inTransaction()).toBe(false);
    expect(unitOfWork.executor()).toBe(database.knex);

    await unitOfWork.run(async () => {
      expect(unitOfWork.inTransaction()).toBe(true);
      expect(unitOfWork.executor()).not.toBe(database.knex);
      await Promise.resolve();
      expect(unitOfWork.inTransaction()).toBe(true);
    });

    expect(unitOfWork.inTransaction()).toBe(false);
  });

  it('joins the outer transaction on a nested run: one rollback undoes both', async () => {
    const { unitOfWork, repository } = wire();

    database.queries.length = 0;

    const failing = unitOfWork.run(async () => {
      const outer = unitOfWork.executor();

      await unitOfWork.run(async () => {
        expect(unitOfWork.executor()).toBe(outer);
        await repository.save(Invoice.draft('inv-1', 100));
      });

      await repository.save(Invoice.draft('inv-2', 200));
      throw new PaymentProviderDown();
    });

    await expect(failing).rejects.toBeInstanceOf(PaymentProviderDown);
    expect(await invoiceIds()).toEqual([]);
    expect(database.queries.filter((query) => /savepoint/i.test(query))).toEqual([]);
    expect(database.queries.filter((query) => /^begin/i.test(query))).toHaveLength(1);
  });

  it('forwards the transaction configuration of knex', async () => {
    const unitOfWork = createKnexUnitOfWork(database.knex, { isolationLevel: 'serializable' });

    const level = await unitOfWork.run(async () => {
      const { rows } = await unitOfWork
        .executor()
        .raw<{ rows: { transaction_isolation: string }[] }>('show transaction_isolation');

      return rows;
    });

    expect(level).toEqual([{ transaction_isolation: 'serializable' }]);
  });

  it('keeps the transactions of two units of work on the same database apart', async () => {
    const first = createKnexUnitOfWork(database.knex);
    const second = createKnexUnitOfWork(database.knex);

    await first.run(async () => {
      expect(first.inTransaction()).toBe(true);
      expect(second.inTransaction()).toBe(false);
    });
  });

  it('isolates concurrent units of work: one fails, the other commits', async () => {
    const { unitOfWork, repository } = wire();

    const results = await Promise.allSettled([
      unitOfWork.run(async () => {
        await repository.save(Invoice.draft('inv-1', 100));
        throw new PaymentProviderDown();
      }),
      unitOfWork.run(async () => {
        await repository.save(Invoice.draft('inv-2', 200));
      }),
    ]);

    expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled']);
    expect(await invoiceIds()).toEqual(['inv-2']);
  });
});

describe('outbox end to end', () => {
  it('relays what the command committed, and nothing of what it rolled back', async () => {
    const { unitOfWork, repository, publisher, store } = wire();
    const bus = new InMemoryEventBus();
    const relay = new OutboxRelay({ store, publisher: bus, clock: new FixedClock(now) });

    await unitOfWork.run(async () => {
      await repository.save(Invoice.draft('inv-1', 100));
      await publisher.publish([issued('inv-1')]);
    });

    await unitOfWork
      .run(async () => {
        await repository.save(Invoice.draft('inv-2', 200));
        await publisher.publish([issued('inv-2')]);
        throw new PaymentProviderDown();
      })
      .catch(() => undefined);

    expect(bus.published).toEqual([]);
    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
    expect(bus.published).toEqual([issued('inv-1')]);
    expect(await relay.tick()).toEqual({ published: 0, failed: 0 });
  });
});

describe('KnexProcessedEventStore in a unit of work', () => {
  it('forgets the mark when the handler fails, so the redelivery is processed', async () => {
    const { unitOfWork, processed: store } = wire();

    const firstDelivery = unitOfWork.run(async () => {
      expect(await store.markProcessed('billing', 'evt-1')).toBe(true);
      throw new PaymentProviderDown();
    });

    await expect(firstDelivery).rejects.toBeInstanceOf(PaymentProviderDown);

    expect(await unitOfWork.run(() => store.markProcessed('billing', 'evt-1'))).toBe(true);
    expect(await unitOfWork.run(() => store.markProcessed('billing', 'evt-1'))).toBe(false);
  });
});
