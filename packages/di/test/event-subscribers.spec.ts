import { describe, expect, it } from 'vitest';
import { EventBus, EventSubscribers, IntegrationEventSubscriber, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { createApplication, createTestApplication, defineContextModule, kernelModule } from '../src';
import { RecordingSubscriber } from './support/fakes/recording-subscriber';
import { SubscribersByContext } from './support/fakes/subscribers-by-context';
import { twiceListening } from './support/twice-listening';
import { orderPlaced } from './support/ordering/published-language/order-placed-event';

const TYPE = 'ordering.order.placed';
const placed = (id: string): IntegrationEvent => orderPlaced(id, { orderId: 'order-1', sku: 'book' });

/** Two contexts that each declare one handler by a class and one by a statement of the module. */
function twoContexts() {
  const journal: string[] = [];

  return { journal, modules: [twiceListening('billing', journal), twiceListening('shipping', journal)] };
}

describe('the subscriber of each context, when a broker gives one per context', () => {
  const brokerModule = (subscribers: EventSubscribers) =>
    defineContextModule({
      name: 'broker',
      register: (builder) => void builder.rebind(EventSubscribers).toValue(subscribers),
    });

  it('receives the declared and the written handlers of its own context, and none of the other', async () => {
    const { journal, modules } = twoContexts();
    const subscribers = new SubscribersByContext();
    const app = createApplication({ modules: [kernelModule(), ...modules, brokerModule(subscribers)] });

    await app.start();

    expect(subscribers.contexts()).toEqual(['billing', 'shipping']);
    expect(subscribers.forContext('billing').subscriptions()).toEqual([TYPE, TYPE]);
    expect(subscribers.forContext('shipping').subscriptions()).toEqual([TYPE, TYPE]);

    await subscribers.forContext('billing').deliver(placed('event-1'));

    expect(journal).toEqual(['billing declared event-1', 'billing written event-1']);

    await subscribers.forContext('shipping').deliver(placed('event-2'));

    expect(journal.slice(2)).toEqual(['shipping declared event-2', 'shipping written event-2']);
  });

  it('leaves the single subscriber alone: nothing listens on the bus of the process', async () => {
    const { journal, modules } = twoContexts();
    const single = new RecordingSubscriber();
    const subscribers = new SubscribersByContext();

    const app = createApplication({
      modules: [kernelModule({ eventSubscriber: single }), ...modules, brokerModule(subscribers)],
    });

    await app.start();
    await app.resolve(EventBus).publish([placed('event-1')]);
    await single.deliver(placed('event-1'));

    expect(single.subscriptions()).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('is asked through the option of the kernel module as well, by the name of the module', async () => {
    const { journal, modules } = twoContexts();
    const subscribers = new SubscribersByContext();
    const app = createApplication({ modules: [kernelModule({ eventSubscribers: () => subscribers }), ...modules] });

    await app.start();
    await subscribers.forContext('shipping').deliver(placed('event-1'));

    expect(subscribers.contexts()).toEqual(['billing', 'shipping']);
    expect(journal).toEqual(['shipping declared event-1', 'shipping written event-1']);
  });

  it('gives its subscriptions back when the application stops', async () => {
    const { journal, modules } = twoContexts();
    const subscribers = new SubscribersByContext();
    const app = createApplication({ modules: [kernelModule({ eventSubscribers: subscribers }), ...modules] });

    await app.start();
    await app.stop();
    await subscribers.forContext('billing').deliver(placed('event-1'));

    expect(subscribers.forContext('billing').subscriptions()).toEqual([]);
    expect(subscribers.forContext('shipping').subscriptions()).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('handles an event once per consumer, not once per context: each consumer name is its own idempotency scope', async () => {
    const { journal, modules } = twoContexts();
    const subscribers = new SubscribersByContext();
    const app = createApplication({ modules: [kernelModule({ eventSubscribers: subscribers }), ...modules] });

    await app.start();

    await subscribers.forContext('billing').deliver(placed('event-1'));
    await subscribers.forContext('billing').deliver(placed('event-1'));
    await subscribers.forContext('shipping').deliver(placed('event-1'));

    expect(journal).toEqual([
      'billing declared event-1',
      'billing written event-1',
      'shipping declared event-1',
      'shipping written event-1',
    ]);
  });
});

describe('the subscriber of each context, by default', () => {
  it('is the single subscriber of the application: every context listens on it', async () => {
    const { journal, modules } = twoContexts();
    const single = new RecordingSubscriber();
    const app = createApplication({ modules: [kernelModule({ eventSubscriber: single }), ...modules] });

    await app.start();
    await single.deliver(placed('event-1'));

    expect(single.subscriptions()).toEqual([TYPE, TYPE, TYPE, TYPE]);
    expect(app.resolve(EventSubscribers).forContext('billing')).toBe(single);
    expect(app.resolve(EventSubscribers).forContext('shipping')).toBe(single);

    expect(journal).toEqual([
      'billing declared event-1',
      'billing written event-1',
      'shipping declared event-1',
      'shipping written event-1',
    ]);
  });

  it('is the event bus when nothing is said, where a published event reaches every context', async () => {
    const { journal, modules } = twoContexts();
    const app = createApplication({ modules: [kernelModule(), ...modules] });

    await app.start();
    await app.resolve(EventBus).publish([placed('event-1')]);

    expect(journal).toHaveLength(4);
  });

  it('is the in-memory bus of a test application, whatever the modules bind', async () => {
    const { journal, modules } = twoContexts();
    const broker = kernelModule({ eventSubscribers: new SubscribersByContext() });
    const app = createTestApplication({ modules: [broker, ...modules] });

    await app.start();
    await app.eventBus.publish([placed('event-1')]);

    expect(app.get(EventSubscribers).forContext('billing')).toBe(app.eventBus);
    expect(journal).toHaveLength(4);
  });
});

describe('an application without the kernel module', () => {
  it('still works when a module binds only the single subscriber', async () => {
    const { journal, modules } = twoContexts();
    const single = new RecordingSubscriber();

    const platform = defineContextModule({
      name: 'platform',
      register: (builder) => void builder.bind(IntegrationEventSubscriber).toValue(single),
    });

    const app = createApplication({ modules: [platform, ...modules] });

    await app.start();
    await single.deliver(placed('event-1'));
    await app.stop();

    expect(journal).toEqual([
      'billing declared event-1',
      'billing written event-1',
      'shipping declared event-1',
      'shipping written event-1',
    ]);

    expect(single.subscriptions()).toEqual([]);
  });

  it('works as well when a module binds only the subscribers by context', async () => {
    const { journal, modules } = twoContexts();
    const subscribers = new SubscribersByContext();

    const broker = defineContextModule({
      name: 'broker',
      register: (builder) => void builder.bind(EventSubscribers).toValue(subscribers),
    });

    const app = createApplication({ modules: [broker, ...modules] });

    await app.start();
    await subscribers.forContext('shipping').deliver(placed('event-1'));

    expect(journal).toEqual(['shipping declared event-1', 'shipping written event-1']);
  });
});

describe('the failure of a single event handler on the default bus', () => {
  const refusal = new Error('cannot invoice order-1');

  const refusing = async (): Promise<void> => {
    throw refusal;
  };

  it('reaches the publisher in an AggregateError when nothing is said', async () => {
    const bus = createApplication({ modules: [kernelModule()] }).resolve(EventBus);

    bus.subscribe(TYPE, refusing);

    await expect(bus.publish([placed('event-1')])).rejects.toMatchObject({ errors: [refusal] });
  });

  it('reaches the publisher as it is when the kernel module delivers failures as thrown', async () => {
    const bus = createApplication({ modules: [kernelModule({ eventBusFailures: 'as-thrown' })] }).resolve(EventBus);

    bus.subscribe(TYPE, refusing);

    await expect(bus.publish([placed('event-1')])).rejects.toBe(refusal);
  });

  it('reaches the publisher as it is when the test application delivers failures as thrown', async () => {
    const app = createTestApplication({ modules: [], eventBusFailures: 'as-thrown' });

    app.eventBus.subscribe(TYPE, refusing);

    await expect(app.eventBus.publish([placed('event-1')])).rejects.toBe(refusal);
  });
});
