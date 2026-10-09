import { describe, expect, it } from 'vitest';
import { FixedClock, type UnitOfWork } from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  COMMAND_BUS,
  EVENT_PUBLISHER,
  UNIT_OF_WORK,
  createTestApplication,
  fake,
  kernelModule,
  token,
} from '../src/index.js';
import { wiringFailure } from './support/failure.js';
import {
  CancelOrder,
  GetOrder,
  INVOICE_LEDGER,
  InMemoryOrderRepository,
  ORDER_REPOSITORY,
  PlaceOrder,
  billingModule,
  orderingModule,
  type OrderRepository,
} from './support/ordering.js';

describe('createTestApplication', () => {
  it('makes a handler spec: fakes in, a command through the bus, the fake asserted', async () => {
    const orders = new InMemoryOrderRepository();
    const app = createTestApplication({ modules: [orderingModule], fakes: [fake(ORDER_REPOSITORY, orders)] });

    const id = await app.commandBus.execute(new PlaceOrder('book'));

    expect(orders.orders.get(id)).toEqual({
      id: 'id-1',
      sku: 'book',
      placedAt: new Date('2026-01-01T00:00:00.000Z'),
      cancelled: false,
    });
    expect(app.eventBus.published).toMatchObject([
      { id: 'id-2', type: 'ordering.order.placed', payload: { orderId: 'id-1', sku: 'book' } },
    ]);
  });

  it('gives a clock a test can move and identifiers it can predict', async () => {
    const app = createTestApplication({
      modules: [orderingModule],
      now: new Date('2026-03-01T10:00:00.000Z'),
      idPrefix: 'order',
    });

    app.clock.advance(60_000);
    const id = await app.commandBus.execute(new PlaceOrder('pen'));

    expect(id).toBe('order-1');
    expect((await app.queryBus.execute(new GetOrder(id)))?.placedAt).toEqual(
      new Date('2026-03-01T10:01:00.000Z'),
    );
    expect(app.ids.next()).toBe('order-3');
  });

  it('resolves anything else with get, typed by its token', async () => {
    const app = createTestApplication({ modules: [orderingModule] });

    const id = await app.commandBus.execute(new PlaceOrder('book'));
    await app.commandBus.execute(new CancelOrder(id));
    const orders: OrderRepository = app.get(ORDER_REPOSITORY);

    expect((await orders.findById(id))?.cancelled).toBe(true);
    expect(app.get(CLOCK)).toBe(app.clock);
    expect(app.get(COMMAND_BUS)).toBe(app.commandBus);
    expect(app.get(EVENT_PUBLISHER)).toBe(app.eventBus);
  });

  it('replaces the production kernel when the modules already list it', () => {
    const production = kernelModule({ clock: new FixedClock(new Date('1999-12-31T23:59:59.000Z')) });

    const app = createTestApplication({ modules: [production, orderingModule] });

    expect(app.get(CLOCK).now()).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(app.describe().overrides).toContain('kernel.Clock');
  });

  it('runs commands in the unit of work, which a test can fake too', async () => {
    const committed: string[] = [];
    const recording: UnitOfWork = {
      run: async (work) => {
        const result = await work();
        committed.push('commit');
        return result;
      },
    };
    const app = createTestApplication({ modules: [orderingModule], fakes: [fake(UNIT_OF_WORK, recording)] });

    const id = await app.commandBus.execute(new PlaceOrder('book'));
    await app.queryBus.execute(new GetOrder(id));

    expect(committed).toEqual(['commit']);
  });

  it('delivers integration events to consumers once started, each event once', async () => {
    const app = createTestApplication({ modules: [orderingModule, billingModule] });
    await app.start();

    const id = await app.commandBus.execute(new PlaceOrder('book'));
    await app.eventBus.publish([...app.eventBus.published]);
    await app.stop();

    expect(app.get(INVOICE_LEDGER).invoicedOrders).toEqual([id]);
  });

  it('refuses a fake for a token that no module binds or depends on', () => {
    const MISTYPED = token<OrderRepository>('ordering.OrderRepository');

    const error = wiringFailure(() =>
      createTestApplication({
        modules: [orderingModule],
        fakes: [fake(MISTYPED, new InMemoryOrderRepository())],
      }),
    );

    expect(error.code).toBe('UNKNOWN_FAKE');
    expect(error.message).toContain('"ordering.OrderRepository"');
  });

  it('accepts a fake for a dependency whose module is not loaded', () => {
    const app = createTestApplication({
      modules: [billingModule],
      fakes: [fake(INVOICE_LEDGER, { invoicedOrders: ['order-0'] })],
    });

    expect(app.get(INVOICE_LEDGER).invoicedOrders).toEqual(['order-0']);
  });

  it('rejects, at compile time, a fake that does not implement the port', () => {
    // @ts-expect-error a clock is not an order repository
    const mismatched = fake(ORDER_REPOSITORY, new FixedClock(new Date(0)));

    expect(mismatched[0]).toBe(ORDER_REPOSITORY);
  });
});
