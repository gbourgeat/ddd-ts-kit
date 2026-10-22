import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  InMemoryEventBus,
  InMemoryProcessedEventStore,
  InMemoryUnitOfWork,
  executionContext,
  scopedPublisher,
  systemActor,
  type Actor,
  type ExecutionContext,
  type IntegrationEvent,
  type ProcessedEventStore,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryOutboxStore,
  InvalidEventPayloadError,
  OutboxPublisher,
  consume,
  on,
  subscribeAll,
  type PayloadOf,
} from '../src';
import { at, orderPlacedV1 } from './support/events';
import { TransactionalMemory } from './support/transactional-memory';
import { TransactionalProcessedEventStore } from './support/transactional-processed-event-store';

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

    await expect(handler({ ...placed('evt-2'), payload: {} })).rejects.toBeInstanceOf(InvalidEventPayloadError);

    expect(memory.commits).toBe(0);
    expect(memory.committed().processed.size).toBe(0);
  });

  it('scopes the deduplication to the consumer', async () => {
    const bus = new InMemoryEventBus();
    const processed = new InMemoryProcessedEventStore();
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
      processed: new InMemoryProcessedEventStore(),
    });

    await expect(handler(placed('evt-1'))).rejects.toBeInstanceOf(InvoicingFailed);
    await handler(placed('evt-1'));
    await handler(placed('evt-1'));

    expect(handled).toEqual(['evt-1']);
  });

  it('keeps the mark of a success when the event is delivered again', async () => {
    const processed = new InMemoryProcessedEventStore();
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
  private readonly seen = new Set<string>();

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = `${consumer} ${eventId}`;

    if (this.seen.has(key)) {
      return false;
    }

    this.seen.add(key);

    return true;
  }
}

describe('a consumer given an execution scope', () => {
  const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };

  it('handles each event in a context of origin event, correlated and caused by it, as the consumer', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const seen: (ExecutionContext | undefined)[] = [];
    const { handler } = on(orderPlacedV1, async () => void seen.push(scope.current()), { consumer: 'billing', scope });

    await handler({ ...placed('evt-1'), correlationId: 'corr-1' });
    await handler(placed('evt-2'));

    expect(seen).toEqual([
      { correlationId: 'corr-1', causationId: 'evt-1', actor: systemActor('billing'), origin: 'event', extensions: {} },
      { correlationId: 'evt-2', causationId: 'evt-2', actor: systemActor('billing'), origin: 'event', extensions: {} },
    ]);

    expect(scope.current()).toBeUndefined();
  });

  it('opens the scope around the unit of work, so the mark and the writes see it', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const memory = new TransactionalMemory();
    const seenByStore: (string | undefined)[] = [];

    const processed: ProcessedEventStore = {
      markProcessed: async () => {
        seenByStore.push(scope.current()?.correlationId);

        return memory.inTransaction();
      },
    };

    const { handler } = consume(
      orderPlacedV1,
      { consumer: 'billing', processed, unitOfWork: memory, scope },
      async () => {
        seenByStore.push(scope.current()?.causationId);
      },
    );

    await handler({ ...placed('evt-1'), correlationId: 'corr-1' });

    expect(seenByStore).toEqual(['corr-1', 'evt-1']);
  });

  it('acts as the actor the project reads from its own envelope', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const actors: (string | undefined)[] = [];

    const { handler } = on(orderPlacedV1, async () => void actors.push(scope.current()?.tenantId), {
      consumer: 'billing',
      scope,
      actorOf: () => ada,
    });

    await handler(placed('evt-1'));

    expect(actors).toEqual(['acme']);
  });
});

describe('the correlation of one stimulus, from a command to the consumers of its events', () => {
  it('is stamped by scopedPublisher on the outbox and found again by the consumer', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const store = new InMemoryOutboxStore();
    const publisher = scopedPublisher(new OutboxPublisher(store), scope);
    const request = executionContext({ correlationId: 'corr-7', actor: systemActor('test'), origin: 'http' });
    const seen: (string | undefined)[] = [];

    const { handler } = on(orderPlacedV1, async () => void seen.push(scope.current()?.correlationId), {
      consumer: 'billing',
      scope,
    });

    await scope.run(request, () => publisher.publish([placed('evt-1')]));

    for (const { event } of store.records()) {
      await handler(event);
    }

    expect(store.records().map(({ event }) => event.correlationId)).toEqual(['corr-7']);
    expect(seen).toEqual(['corr-7']);
  });
});
