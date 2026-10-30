import { describe, expect, it } from 'vitest';
import {
  CommandBus,
  EventBus,
  InMemoryCommandBus,
  InMemoryEventBus,
  IntegrationEventSubscriber,
  type IntegrationEvent,
  type IntegrationEventCallback,
  type Subscription,
} from '@ddd-ts-kit/kernel';
import {
  UnreadableEventError,
  createApplication,
  createTestApplication,
  defineContextModule,
  kernelModule,
  type ContextModule,
  type EventContract,
} from '../src';
import { InvoiceOnOrderPlaced } from './support/billing/application/integration/handlers/invoice-on-order-placed.integration-handler';
import { InvoiceLedger } from './support/billing/application/ports/invoice-ledger.port';
import { billingModule } from './support/billing/billing.module';
import { wiringFailure } from './support/failure';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command';
import { orderingModule } from './support/ordering/ordering.module';
import { orderPlaced } from './support/ordering/published-language/order-placed-event';
import { OrderPlaced } from './support/ordering/published-language/order-placed';

const placed = (id: string, orderId: string): IntegrationEvent => orderPlaced(id, { orderId, sku: 'book' });
const neverSeenBefore = { markProcessed: async () => true };

function busesWithoutProcessedEvents(bus: InMemoryEventBus): ContextModule {
  return defineContextModule({
    name: 'platform',
    register(builder) {
      builder.bind(IntegrationEventSubscriber).toValue(bus);
      builder.bind(CommandBus).toClass(InMemoryCommandBus);
    },
  });
}

/** A bus whose subscriptions cannot be released, as a broker whose connection dropped. */
class StuckBus extends InMemoryEventBus {
  override subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    super.subscribe(type, handler);

    return {
      unsubscribe: () => {
        throw new Error('the channel is already closed');
      },
    };
  }
}

describe('consumers declared with builder.on', () => {
  it('receive nothing before start, the events after it, and nothing once stopped', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });
    const bus = app.resolve(EventBus);

    await bus.publish([placed('event-1', 'order-1')]);
    await app.start();
    await bus.publish([placed('event-2', 'order-2')]);
    await app.stop();
    await bus.publish([placed('event-3', 'order-3')]);

    expect(app.resolve(InvoiceLedger).invoicedOrders).toEqual(['order-2']);
  });

  it('are released when the application stops, and one that cannot be is reported with the stop', async () => {
    const app = createApplication({ modules: [busesWithoutProcessedEvents(new StuckBus()), billingModule] });

    await app.start();

    const failure = await app.stop().then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure).toMatchObject({ message: '1 module(s) failed to stop' });

    expect(failure instanceof AggregateError ? failure.errors : []).toEqual([
      new Error('the channel is already closed'),
    ]);
  });

  it('subscribe once, however many times the application is started', async () => {
    const app = createApplication({
      modules: [kernelModule({ processedEvents: () => neverSeenBefore }), billingModule],
    });

    await app.start();
    await app.start();
    await app.resolve(EventBus).publish([placed('event-1', 'order-1')]);

    expect(app.resolve(InvoiceLedger).invoicedOrders).toEqual(['order-1']);
  });

  it('handle a redelivered event once when a processed event store is bound', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    await app.start();

    await app.resolve(EventBus).publish([placed('event-1', 'order-1'), placed('event-1', 'order-1')]);

    expect(app.resolve(InvoiceLedger).invoicedOrders).toEqual(['order-1']);
  });

  it('handle every delivery when no processed event store is bound', async () => {
    const bus = new InMemoryEventBus();
    const app = createApplication({ modules: [busesWithoutProcessedEvents(bus), billingModule] });

    await app.start();

    await bus.publish([placed('event-1', 'order-1'), placed('event-1', 'order-1')]);

    expect(app.resolve(InvoiceLedger).invoicedOrders).toEqual(['order-1', 'order-1']);
  });

  it('skip another version of the event without consuming its idempotency key', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    await app.start();

    await app.resolve(EventBus).publish([orderPlaced('event-1', { order: 'renamed in v2' }, 2)]);
    await app.resolve(EventBus).publish([placed('event-1', 'order-1')]);

    expect(app.resolve(InvoiceLedger).invoicedOrders).toEqual(['order-1']);
  });

  it('refuse an event its contract cannot read, so the provider retries it', async () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    await app.start();

    const failure = await app
      .resolve(EventBus)
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

  it('are delivered the events of a test application once started, each event once', async () => {
    const app = createTestApplication({ modules: [orderingModule, billingModule] });

    await app.start();

    const id = await app.commandBus.execute(new PlaceOrder('book'));

    await app.eventBus.publish([...app.eventBus.published]);
    await app.stop();

    expect(app.get(InvoiceLedger).invoicedOrders).toEqual([id]);
  });
});

describe('the declaration of a consumer', () => {
  const audit = (handle: (orderId: string) => void = () => {}): ContextModule =>
    defineContextModule({
      name: 'audit',
      register(builder) {
        builder
          .on(OrderPlaced, { consumer: 'audit.order-placed' })
          .handledByFactory(() => ({ handle: async (event) => void handle(event.payload.orderId) }));
      },
    });

  it('takes a factory and appears in the description', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule, audit()] });

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

  it('binds the handler class under itself, as a consumer', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    expect(app.resolve(InvoiceOnOrderPlaced)).toBeInstanceOf(InvoiceOnOrderPlaced);

    expect(app.describe().bindings).toContainEqual(
      expect.objectContaining({ token: 'InvoiceOnOrderPlaced', kind: 'consumer', dependencies: ['CommandBus'] }),
    );
  });

  it('rejects two consumers sharing a name for the same event, before the class bound twice', () => {
    const twin = defineContextModule({
      name: 'twin',
      register(builder) {
        builder
          .on(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })
          .handledBy(InvoiceOnOrderPlaced, [CommandBus]);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), billingModule, twin] }));

    expect(error.code).toBe('DUPLICATE_CONSUMER');
    expect(error.message).toContain('in module "billing" and in module "twin"');
  });

  it('rejects a handler class given to two consumers: one class is one binding', () => {
    const twin = defineContextModule({
      name: 'twin',
      register(builder) {
        builder
          .on(OrderPlaced, { consumer: 'twin.invoice-on-order-placed' })
          .handledBy(InvoiceOnOrderPlaced, [CommandBus]);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), billingModule, twin] }));

    expect(error.code).toBe('DUPLICATE_BINDING');

    expect(error.message).toBe(
      'Token "InvoiceOnOrderPlaced" is bound twice: by module "billing" and by module "twin".',
    );
  });

  it('asks for the kernel module when there is nothing to subscribe to', () => {
    const error = wiringFailure(() => createApplication({ modules: [audit()] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');

    expect(error.message).toBe(
      'Module "audit" declares the consumer "audit.order-placed", but no module binds "IntegrationEventSubscriber" or "EventSubscribers". Add kernelModule() to the modules.',
    );
  });

  it('is typed: a consumer of another payload and a consumer without a name are refused at compile time', () => {
    const neverParsed = (): never => {
      throw new Error('this contract only exists for the compiler');
    };

    const Shipped: EventContract<{ parcelId: string }> = {
      ...OrderPlaced,
      type: 'shipping.parcel.shipped',
      parse: neverParsed,
    };

    const module = defineContextModule({
      name: 'typed',
      register(builder) {
        // @ts-expect-error InvoiceOnOrderPlaced handles OrderPlaced, not a shipped parcel
        builder.on(Shipped, { consumer: 'billing.on-shipped' }).handledBy(InvoiceOnOrderPlaced, [CommandBus]);
        // @ts-expect-error the consumer name is the idempotency scope and has no default
        builder.on(OrderPlaced).handledBy(InvoiceOnOrderPlaced, [CommandBus]);
      },
    });

    expect(module.name).toBe('typed');
  });
});
