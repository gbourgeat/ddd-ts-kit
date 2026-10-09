import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, InMemoryEventBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import {
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
  createDrizzleUnitOfWork,
  outboxTable,
  processedEventsTable,
} from '../src/postgres.js';
import { createDatabase } from './support/database.js';
import { DrizzleInvoiceRepository, Invoice, invoices } from './support/invoices.js';
import { ada, scopeOf } from './support/scopes.js';

const outbox = outboxTable();
const processed = processedEventsTable();
const now = new Date('2026-03-01T10:00:00.000Z');

let database: Awaited<ReturnType<typeof createDatabase>>;
beforeAll(async () => {
  database = await createDatabase([invoices, outbox, processed]);
});
afterAll(async () => {
  await database.client.close();
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

/** The wiring of a composition root, on PGlite. */
const wire = () => {
  const unitOfWork = createDrizzleUnitOfWork(database.db);
  const store = new DrizzleOutboxStore(unitOfWork, { table: outbox });
  return {
    unitOfWork,
    store,
    repository: new DrizzleInvoiceRepository(unitOfWork, scopeOf(ada), new FixedClock(now)),
    publisher: new OutboxPublisher(store),
    processed: new DrizzleProcessedEventStore(unitOfWork, { table: processed }),
  };
};

class PaymentProviderDown extends Error {}

describe('createDrizzleUnitOfWork', () => {
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
    expect(await database.db.select().from(outbox)).toEqual([]);
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

  it('gives the transaction inside run and the database outside', async () => {
    const { unitOfWork } = wire();

    expect(unitOfWork.inTransaction()).toBe(false);
    expect(unitOfWork.executor()).toBe(database.db);

    await unitOfWork.run(async () => {
      expect(unitOfWork.inTransaction()).toBe(true);
      expect(unitOfWork.executor()).not.toBe(database.db);
      await Promise.resolve();
      expect(unitOfWork.inTransaction()).toBe(true);
    });

    expect(unitOfWork.inTransaction()).toBe(false);
  });

  it('joins the outer transaction on a nested run: one rollback undoes both', async () => {
    const { unitOfWork, repository } = wire();
    database.logger.queries.length = 0;

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
    expect(await database.db.select().from(invoices)).toEqual([]);
    expect(database.logger.queries.filter((query) => /savepoint/i.test(query))).toEqual([]);
  });

  it('keeps the transactions of two units of work on the same database apart', async () => {
    const first = createDrizzleUnitOfWork(database.db);
    const second = createDrizzleUnitOfWork(database.db);

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
    expect((await database.db.select().from(invoices)).map((row) => row.id)).toEqual(['inv-2']);
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

describe('DrizzleProcessedEventStore in a unit of work', () => {
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
