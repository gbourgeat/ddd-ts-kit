import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, InMemoryEventBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  COMMAND_BUS,
  EVENT_BUS,
  EVENT_SUBSCRIBER,
  UnreadableEventError,
  createApplication,
  defineContextModule,
  kernelModule,
  type ContextModule,
  type EventContract,
} from '../src/index.js';
import { wiringFailure } from './support/failure.js';
import {
  INVOICE_LEDGER,
  InvoiceOnOrderPlaced,
  OrderPlaced,
  billingModule,
  orderPlaced,
} from './support/ordering.js';

const placed = (id: string, orderId: string): IntegrationEvent => orderPlaced(id, { orderId, sku: 'book' });

describe('consumers declared with builder.on', () => {
  it('receive nothing before start, the events after it, and nothing once stopped', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });
    const bus = app.resolve(EVENT_BUS);

    await bus.publish([placed('event-1', 'order-1')]);
    await app.start();
    await bus.publish([placed('event-2', 'order-2')]);
    await app.stop();
    await bus.publish([placed('event-3', 'order-3')]);

    expect(app.resolve(INVOICE_LEDGER).invoicedOrders).toEqual(['order-2']);
  });

  it('subscribe once, however many times the application is started', async () => {
    const app = createApplication({
      modules: [kernelModule({ processedEvents: () => neverSeenBefore }), billingModule],
    });

    await app.start();
    await app.start();
    await app.resolve(EVENT_BUS).publish([placed('event-1', 'order-1')]);

    expect(app.resolve(INVOICE_LEDGER).invoicedOrders).toEqual(['order-1']);
  });

  it('handle a redelivered event once when a processed event store is bound', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });
    await app.start();

    await app.resolve(EVENT_BUS).publish([placed('event-1', 'order-1'), placed('event-1', 'order-1')]);

    expect(app.resolve(INVOICE_LEDGER).invoicedOrders).toEqual(['order-1']);
  });

  it('handle every delivery when no processed event store is bound', async () => {
    const bus = new InMemoryEventBus();
    const app = createApplication({ modules: [busesWithoutProcessedEvents(bus), billingModule] });
    await app.start();

    await bus.publish([placed('event-1', 'order-1'), placed('event-1', 'order-1')]);

    expect(app.resolve(INVOICE_LEDGER).invoicedOrders).toEqual(['order-1', 'order-1']);
  });

  it('skip another version of the event without consuming its idempotency key', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });
    await app.start();

    await app.resolve(EVENT_BUS).publish([orderPlaced('event-1', { order: 'renamed in v2' }, 2)]);
    await app.resolve(EVENT_BUS).publish([placed('event-1', 'order-1')]);

    expect(app.resolve(INVOICE_LEDGER).invoicedOrders).toEqual(['order-1']);
  });

  it('refuse an event its contract cannot read, so the provider retries it', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });
    await app.start();

    const failure = await app
      .resolve(EVENT_BUS)
      .publish([orderPlaced('event-1', { orderId: 42 })])
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure).toMatchObject({
      errors: [{ code: 'UNREADABLE_EVENT', eventType: 'ordering.order.placed', reason: 'invalid-payload' }],
    });
    expect(new UnreadableEventError('a.b.c', 1, 'invalid-payload').message).toBe(
      'Cannot read a.b.c v1: invalid-payload',
    );
  });

  it('take a factory and appear in the description', () => {
    const received: string[] = [];
    const audit = defineContextModule({
      name: 'audit',
      register(builder) {
        builder
          .on(OrderPlaced, { consumer: 'audit.order-placed' })
          .handledByFactory(() => ({ handle: async (event) => void received.push(event.payload.orderId) }));
      },
    });

    const app = createApplication({ modules: [kernelModule(), billingModule, audit] });

    expect(app.describe().integrationEventHandlers).toEqual([
      {
        event: 'ordering.order.placed',
        version: 1,
        consumer: 'billing.invoice-on-order-placed',
        handler: 'InvoiceOnOrderPlaced',
        module: 'billing',
      },
      {
        event: 'ordering.order.placed',
        version: 1,
        consumer: 'audit.order-placed',
        handler: 'on(ordering.order.placed) handler',
        module: 'audit',
      },
    ]);
  });

  it('reject two consumers sharing a name for the same event', () => {
    const twin = defineContextModule({
      name: 'twin',
      register(builder) {
        builder
          .on(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })
          .handledBy(InvoiceOnOrderPlaced, [COMMAND_BUS]);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), billingModule, twin] }));

    expect(error.code).toBe('DUPLICATE_CONSUMER');
    expect(error.message).toContain('"billing"');
    expect(error.message).toContain('"twin"');
  });

  it('ask for the kernel module when there is nothing to subscribe to', () => {
    const audit = defineContextModule({
      name: 'audit',
      register(builder) {
        builder
          .on(OrderPlaced, { consumer: 'audit.order-placed' })
          .handledByFactory(() => ({ handle: async () => {} }));
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [audit] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');
    expect(error.message).toContain('the consumer "audit.order-placed"');
    expect(error.message).toContain('"kernel.EventSubscriber"');
  });

  it('reject, at compile time, a consumer of another payload', () => {
    const Shipped: EventContract<{ parcelId: string }> = { ...OrderPlaced, type: 'shipping.parcel.shipped', parse: neverParsed };
    const module = defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error InvoiceOnOrderPlaced handles OrderPlaced, not a shipped parcel
        builder.on(Shipped, { consumer: 'billing.on-shipped' }).handledBy(InvoiceOnOrderPlaced, [COMMAND_BUS]);
        // @ts-expect-error the consumer name is the idempotency scope and has no default
        builder.on(OrderPlaced).handledBy(InvoiceOnOrderPlaced, [COMMAND_BUS]);
      },
    });

    expect(module.name).toBe('typed');
  });
});

const neverSeenBefore = { markProcessed: async () => true };

function neverParsed(): never {
  throw new Error('this contract only exists for the compiler');
}

function busesWithoutProcessedEvents(bus: InMemoryEventBus): ContextModule {
  return defineContextModule({
    name: 'platform',
    register(builder) {
      builder.bind(EVENT_SUBSCRIBER).toValue(bus);
      builder.bind(COMMAND_BUS).toClass(InMemoryCommandBus);
    },
  });
}
