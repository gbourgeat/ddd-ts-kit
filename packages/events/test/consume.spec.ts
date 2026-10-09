import { describe, expect, it } from 'vitest';
import {
  InMemoryEventBus,
  InMemoryUnitOfWork,
  type IntegrationEvent,
  type ProcessedEventStore,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryReleasableProcessedEventStore,
  InvalidEventPayloadError,
  consume,
  on,
  subscribeAll,
  type PayloadOf,
} from '../src/index.js';
import { at, orderPlacedV1 } from './support/events.js';
import {
  TransactionalMemory,
  TransactionalProcessedEventStore,
} from './support/transactional-memory.js';

const placed = (id: string, orderId = 'order-1'): IntegrationEvent<PayloadOf<typeof orderPlacedV1>> =>
  orderPlacedV1.create({ orderId, total: 30 }, { id, occurredAt: at });

class InvoicingFailed extends Error {
  readonly code = 'INVOICING_FAILED';
}

/** A consumer writing in the transactional memory, failing its first `failures` deliveries. */
const invoicing = (memory: TransactionalMemory, failures = 0) => {
  let remaining = failures;
  return consume(
    orderPlacedV1,
    {
      consumer: 'billing',
      processed: new TransactionalProcessedEventStore(memory),
      unitOfWork: memory,
    },
    async (event) => {
      memory.state().invoicedOrders.push(event.payload.orderId);
      if (remaining > 0) {
        remaining -= 1;
        throw new InvoicingFailed();
      }
    },
  );
};

describe('consume', () => {
  it('runs the deduplication and the handler in one unit of work', async () => {
    const memory = new TransactionalMemory();
    const transactions: boolean[] = [];
    const { handler } = consume(
      orderPlacedV1,
      {
        consumer: 'billing',
        processed: new TransactionalProcessedEventStore(memory),
        unitOfWork: memory,
      },
      async () => {
        transactions.push(memory.inTransaction());
      },
    );

    await handler(placed('evt-1'));

    expect(transactions).toEqual([true]);
    expect(memory.commits).toBe(1);
    expect(memory.committed().processed.size).toBe(1);
  });

  it('processes again, on redelivery, an event whose handler threw', async () => {
    const memory = new TransactionalMemory();
    const { handler } = invoicing(memory, 1);

    await expect(handler(placed('evt-1'))).rejects.toBeInstanceOf(InvoicingFailed);
    expect(memory.committed()).toEqual({ processed: new Set(), invoicedOrders: [] });
    await handler(placed('evt-1'));

    expect(memory.committed().invoicedOrders).toEqual(['order-1']);
  });

  it('handles a redelivered event once', async () => {
    const memory = new TransactionalMemory();
    const { handler } = invoicing(memory);

    await handler(placed('evt-1'));
    await handler(placed('evt-1'));
    await handler(placed('evt-2', 'order-2'));

    expect(memory.committed().invoicedOrders).toEqual(['order-1', 'order-2']);
  });

  it('does not consume the idempotency key of an event it rejects or skips', async () => {
    const memory = new TransactionalMemory();
    const { handler } = invoicing(memory);

    await handler({ ...placed('evt-1'), version: 2 });
    await expect(handler({ ...placed('evt-2'), payload: {} })).rejects.toBeInstanceOf(
      InvalidEventPayloadError,
    );

    expect(memory.commits).toBe(0);
    expect(memory.committed().processed.size).toBe(0);
  });

  it('scopes the deduplication to the consumer', async () => {
    const bus = new InMemoryEventBus();
    const processed = new InMemoryReleasableProcessedEventStore();
    const unitOfWork = new InMemoryUnitOfWork();
    const handled: string[] = [];
    const consumerNamed = (consumer: string) =>
      consume(orderPlacedV1, { consumer, processed, unitOfWork }, async (event) => {
        handled.push(`${consumer}:${event.id}`);
      });
    subscribeAll(bus, [consumerNamed('billing'), consumerNamed('shipping')]);

    await bus.publish([placed('evt-1'), placed('evt-1')]);

    expect(handled).toEqual(['billing:evt-1', 'shipping:evt-1']);
  });
});

describe('a handler that fails, without a transaction to roll the mark back', () => {
  const failingOnce = (handled: string[]) => {
    let failed = false;
    return async (event: IntegrationEvent) => {
      if (!failed) {
        failed = true;
        throw new InvoicingFailed();
      }
      handled.push(event.id);
    };
  };

  it('is processed again on redelivery when the store can release its mark', async () => {
    const handled: string[] = [];
    const { handler } = on(orderPlacedV1, failingOnce(handled), {
      consumer: 'billing',
      processed: new InMemoryReleasableProcessedEventStore(),
    });

    await expect(handler(placed('evt-1'))).rejects.toBeInstanceOf(InvoicingFailed);
    await handler(placed('evt-1'));
    await handler(placed('evt-1'));

    expect(handled).toEqual(['evt-1']);
  });

  it('keeps the mark of a success when the event is delivered again', async () => {
    const processed = new InMemoryReleasableProcessedEventStore();
    const handled: string[] = [];
    const { handler } = on(orderPlacedV1, async (event) => void handled.push(event.id), {
      consumer: 'billing',
      processed,
    });

    await handler(placed('evt-1'));
    await handler(placed('evt-1'));

    expect(handled).toEqual(['evt-1']);
    expect(await processed.markProcessed('billing', 'evt-1')).toBe(false);
  });

  it('loses the event with a store that can neither roll back nor release', async () => {
    const handled: string[] = [];
    const { handler } = on(orderPlacedV1, failingOnce(handled), {
      consumer: 'billing',
      processed: new MarkOnlyStore(),
    });

    await expect(handler(placed('evt-1'))).rejects.toBeInstanceOf(InvoicingFailed);
    await handler(placed('evt-1'));

    expect(handled).toEqual([]);
  });
});

class MarkOnlyStore implements ProcessedEventStore {
  readonly #seen = new Set<string>();

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = `${consumer} ${eventId}`;
    if (this.#seen.has(key)) return false;
    this.#seen.add(key);
    return true;
  }
}
