import { describe, expect, it } from 'vitest';
import { Clock, CommandBus, FixedClock, IntegrationEventPublisher, UnitOfWork } from '@ddd-ts-kit/kernel';
import { createTestApplication, fake, kernelModule } from '../src/index.js';
import { InvoiceLedger } from './support/billing/application/ports/invoice-ledger.port.js';
import { billingModule } from './support/billing/billing.module.js';
import { InMemoryInvoiceLedger } from './support/billing/infrastructure/persistence/in-memory-invoice-ledger.js';
import { wiringFailure } from './support/failure.js';
import { CancelOrder } from './support/ordering/application/commands/cancel-order/cancel-order.command.js';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command.js';
import { GetOrder } from './support/ordering/application/queries/get-order/get-order.query.js';
import { OrderRepository } from './support/ordering/domain/repositories/order.repository.js';
import { InMemoryOrderRepository } from './support/ordering/infrastructure/persistence/in-memory-order.repository.js';
import { orderingModule } from './support/ordering/ordering.module.js';

describe('createTestApplication', () => {
  it('makes a handler spec: fakes in, a command through the bus, the fake asserted', async () => {
    const orders = new InMemoryOrderRepository();
    const app = createTestApplication({ modules: [orderingModule], fakes: [fake(OrderRepository, orders)] });

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

  it('resolves anything else with get, typed by its port', async () => {
    const app = createTestApplication({ modules: [orderingModule] });

    const id = await app.commandBus.execute(new PlaceOrder('book'));

    await app.commandBus.execute(new CancelOrder(id));
    const orders: OrderRepository = app.get(OrderRepository);

    expect((await orders.findById(id))?.cancelled).toBe(true);
    expect(app.get(Clock)).toBe(app.clock);
    expect(app.get(CommandBus)).toBe(app.commandBus);
    expect(app.get(IntegrationEventPublisher)).toBe(app.eventBus);
  });

  it('replaces the production kernel when the modules already list it', () => {
    const production = kernelModule({ clock: new FixedClock(new Date('1999-12-31T23:59:59.000Z')) });

    const app = createTestApplication({ modules: [production, orderingModule] });

    expect(app.get(Clock).now()).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(app.describe().overrides).toContain('Clock');
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

    const app = createTestApplication({ modules: [orderingModule], fakes: [fake(UnitOfWork, recording)] });

    const id = await app.commandBus.execute(new PlaceOrder('book'));

    await app.queryBus.execute(new GetOrder(id));

    expect(committed).toEqual(['commit']);
  });

  it('refuses a fake for a port that no module binds or depends on', () => {
    abstract class Unused {
      abstract findById(id: string): Promise<undefined>;
    }

    const error = wiringFailure(() =>
      createTestApplication({ modules: [orderingModule], fakes: [fake(Unused, { findById: async () => undefined })] }),
    );

    expect(error.code).toBe('UNKNOWN_FAKE');
    expect(error.message).toContain('A fake is given for "Unused", which no module binds and no class depends on.');
  });

  it('accepts a fake for a dependency whose module is not loaded', () => {
    const ledger = new InMemoryInvoiceLedger();
    const app = createTestApplication({ modules: [billingModule], fakes: [fake(InvoiceLedger, ledger)] });

    expect(app.get(InvoiceLedger)).toBe(ledger);
  });
});
