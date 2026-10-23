import { describe, expect, it } from 'vitest';
import {
  Command,
  Query,
  unitOfWorkMiddleware,
  type CommandHandler,
  type IntegrationEventPublisher,
  type QueryHandler,
} from '@ddd-ts-kit/kernel';
import { ConcurrencyError, InMemoryRepository, createTestBuses, snapshots, type TestBuses } from '../src';
import { Order, at, type OrderSnapshot } from './support/order';

class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}

class GetOrderTotal extends Query<number> {
  constructor(readonly orderId: string) {
    super();
  }
}

class InMemoryOrders extends InMemoryRepository<Order> {
  constructor() {
    super(snapshots({ toSnapshot: (order) => order.toSnapshot(), fromSnapshot: Order.rehydrate }));
  }

  paid(): Order[] {
    return this.all().filter((order) => order.status === 'paid');
  }

  /** What a port with a removal method gives the application. */
  delete(id: string): boolean {
    return this.remove(id);
  }
}

class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly orders: InMemoryOrders,
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: { next(): string },
    private readonly clock: { now(): Date },
  ) {}

  async execute(command: PlaceOrder): Promise<string> {
    const id = this.ids.next();

    const order = Order.place(
      id,
      { id: 'customer-1', name: 'Ada' },
      [{ sku: command.sku, quantity: 2 }],
      this.clock.now(),
    );

    await this.orders.save(order);

    await this.publisher.publish([
      {
        id: this.ids.next(),
        type: 'ordering.order.placed',
        version: 1,
        occurredAt: this.clock.now().toISOString(),
        payload: { orderId: id, total: order.total },
      },
    ]);

    return id;
  }
}

describe('createTestBuses', () => {
  it('makes a handler spec three lines of arrangement', async () => {
    const { commandBus, eventBus, ids, clock, publishedEvents } = createTestBuses({ idPrefix: 'order' });
    const orders = new InMemoryOrders();

    commandBus.register(PlaceOrder, new PlaceOrderHandler(orders, eventBus, ids, clock));

    const id = await commandBus.execute(new PlaceOrder('book'));

    expect(id).toBe('order-1');
    expect(orders.count()).toBe(1);

    expect(publishedEvents<{ orderId: string; total: number }>('ordering.order.placed')).toEqual([
      {
        id: 'order-2',
        type: 'ordering.order.placed',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { orderId: 'order-1', total: 20 },
      },
    ]);

    expect(publishedEvents('billing.invoice.issued')).toEqual([]);
    expect(publishedEvents()).toHaveLength(1);
  });

  it('makes a repository fake dispatch the domain events of what it saves, as the application does', async () => {
    const { dispatching, domainEvents } = createTestBuses({ now: at });
    const orders = dispatching(new InMemoryOrders());
    const heard: string[] = [];

    domainEvents.on('ordering.order.placed', async (event) => void heard.push(`${event.name} ${event.aggregateId}`));
    domainEvents.on('ordering.order.paid', async (event) => void heard.push(`${event.name} ${event.aggregateId}`));

    const order = Order.place('order-1', { id: 'c', name: 'Ada' }, [{ sku: 'pen', quantity: 3 }], at);

    order.pay(at);
    await orders.save(order);

    expect(heard).toEqual(['ordering.order.placed order-1', 'ordering.order.paid order-1']);
    expect(order.pullEvents()).toEqual([]);
    expect(orders.count()).toBe(1);
  });

  it('runs a command in its unit of work: the domain events are heard once the handler has returned, phase after phase', async () => {
    const { commandBus, dispatching, domainEvents, eventBus, ids, clock } = createTestBuses({ idPrefix: 'order' });
    const orders = dispatching(new InMemoryOrders());
    const journal: string[] = [];

    domainEvents.on('ordering.order.placed', async () => void journal.push('after the commit'), {
      phase: 'after-commit',
    });

    domainEvents.on(
      'ordering.order.placed',
      async () => void journal.push(`before the commit, ${eventBus.published.length} event published by the handler`),
    );

    commandBus.register(PlaceOrder, new PlaceOrderHandler(orders, eventBus, ids, clock));

    await commandBus.execute(new PlaceOrder('book'));

    expect(journal).toEqual(['before the commit, 1 event published by the handler', 'after the commit']);
    expect(domainEvents.afterCommitFailures).toEqual([]);
  });

  it('gives a query bus, a frozen clock that can move and a unit of work', async () => {
    const { commandBus, queryBus, clock, unitOfWork } = createTestBuses({ now: at });
    const orders = new InMemoryOrders();

    await orders.save(Order.place('order-1', { id: 'c', name: 'Ada' }, [{ sku: 'pen', quantity: 3 }], at));

    const handler: QueryHandler<GetOrderTotal> = {
      execute: async (query) => (await orders.findById(query.orderId))?.total ?? 0,
    };

    queryBus.register(GetOrderTotal, handler);
    commandBus.use(unitOfWorkMiddleware(unitOfWork));

    expect(await queryBus.execute(new GetOrderTotal('order-1'))).toBe(30);
    expect(clock.now()).toEqual(at);
    clock.advance(1_000);
    expect(clock.now()).toEqual(new Date('2026-03-01T10:00:01.000Z'));
  });
});

describe('createTestBuses, when a handler of an event fails', () => {
  const refusal = new Error('cannot invoice order-1');

  const publishRefused = (buses: TestBuses): Promise<void> => {
    buses.eventBus.subscribe('ordering.order.placed', async () => {
      throw refusal;
    });

    return buses.eventBus.publish([
      { id: 'event-1', type: 'ordering.order.placed', version: 1, occurredAt: at.toISOString(), payload: {} },
    ]);
  };

  it('rejects with an AggregateError holding the failure by default', async () => {
    await expect(publishRefused(createTestBuses())).rejects.toMatchObject({ errors: [refusal] });
  });

  it('rejects with the failure as it is when failures are delivered as thrown', async () => {
    await expect(publishRefused(createTestBuses({ eventBusFailures: 'as-thrown' }))).rejects.toBe(refusal);
  });
});

describe('InMemoryRepository', () => {
  const place = (id: string): Order =>
    Order.place(id, { id: 'customer-1', name: 'Ada' }, [{ sku: 'pen', quantity: 1 }], at);

  it('exposes what is stored for assertions and for the finders of a subclass', async () => {
    const orders = new InMemoryOrders();
    const paid = place('order-2');

    paid.pay(at);
    await orders.save(place('order-1'));
    await orders.save(paid);

    expect(orders.count()).toBe(2);
    expect(orders.all().map((order) => order.id)).toEqual(['order-1', 'order-2']);
    expect(orders.paid().map((order) => order.id)).toEqual(['order-2']);

    orders.clear();
    expect(orders.count()).toBe(0);
  });

  it('lets a subclass remove an aggregate, and says whether there was one', async () => {
    const orders = new InMemoryOrders();

    await orders.save(place('order-1'));

    expect([orders.delete('order-1'), orders.delete('order-1')]).toEqual([true, false]);
    expect(await orders.findById('order-1')).toBeUndefined();
  });

  it('hands out copies: changing one does not change the store', async () => {
    const orders = new InMemoryOrders();

    await orders.save(place('order-1'));

    orders.all()[0]?.pay(at);

    expect(orders.paid()).toEqual([]);
  });

  it('manages the version of the aggregate', async () => {
    const orders = new InMemoryOrders();
    const order = place('order-1');

    expect(order.version).toBe(0);

    await orders.save(order);
    expect(order.version).toBe(1);
    expect((await orders.findById('order-1'))?.version).toBe(1);

    await orders.save(order);
    expect((await orders.findById('order-1'))?.version).toBe(2);
  });

  it('raises a ConcurrencyError on a lost update, and when creating what already exists', async () => {
    const orders = new InMemoryOrders();

    await orders.save(place('order-1'));

    await expect(orders.save(place('order-1'))).rejects.toBeInstanceOf(ConcurrencyError);

    await expect(orders.save(place('order-1'))).rejects.toMatchObject({
      code: 'CONCURRENCY_CONFLICT',
      message: 'Aggregate order-1 was modified concurrently',
    });
  });

  it('works with a clone function instead of snapshots', async () => {
    const clone = (order: Order): Order => Order.rehydrate(structuredClone<OrderSnapshot>(order.toSnapshot()));
    const orders = new InMemoryRepository<Order>({ clone });
    const order = place('order-1');

    await orders.save(order);

    order.pay(at);

    expect((await orders.findById('order-1'))?.status).toBe('placed');
  });
});
