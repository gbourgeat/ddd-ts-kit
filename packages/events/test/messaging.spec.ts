import { describe, expect, it } from 'vitest';
import {
  InMemoryEventBus,
  InMemoryProcessedEventStore,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import {
  DuplicateEventDefinitionError,
  EventRegistry,
  InvalidEventPayloadError,
  UnknownEventError,
  createEventRegistry,
  on,
  subscribeAll,
  validatingPublisher,
  type PayloadOf,
} from '../src/index.js';
import { at, invoiceIssued, orderPlacedV1, orderPlacedV2, shipmentSent } from './support/events.js';

const placedV1 = (id: string): IntegrationEvent<PayloadOf<typeof orderPlacedV1>> =>
  orderPlacedV1.create({ orderId: 'order-1', total: 30 }, { id, occurredAt: at });

const rawEvent = (overrides: Partial<IntegrationEvent>): IntegrationEvent => ({
  id: 'evt-raw',
  type: 'ordering.order.placed',
  version: 1,
  occurredAt: at.toISOString(),
  payload: { orderId: 'order-1', total: 30 },
  ...overrides,
});

describe('EventRegistry', () => {
  it('lists the definitions by type then version, whatever the registration order', () => {
    const registry = new EventRegistry().register(orderPlacedV2, shipmentSent);
    registry.register(invoiceIssued, orderPlacedV1);

    expect(registry.all().map((definition) => `${definition.type}@${definition.version}`)).toEqual([
      'billing.invoice.issued@1',
      'ordering.order.placed@1',
      'ordering.order.placed@2',
      'shipping.shipment.sent@1',
    ]);
  });

  it('finds a definition by type and version', () => {
    const registry = createEventRegistry([orderPlacedV1, orderPlacedV2]);

    expect(registry.get('ordering.order.placed', 2)).toBe(orderPlacedV2);
    expect(registry.get('ordering.order.placed', 3)).toBeUndefined();
    expect(registry.get('billing.invoice.issued', 1)).toBeUndefined();
  });

  it('gives the versions of a type in ascending order', () => {
    const registry = createEventRegistry([orderPlacedV2, orderPlacedV1, invoiceIssued]);

    expect(registry.versionsOf('ordering.order.placed')).toEqual([1, 2]);
    expect(registry.versionsOf('unknown.thing.happened')).toEqual([]);
  });

  it('refuses two definitions with the same type and version', () => {
    const registry = createEventRegistry([orderPlacedV1]);

    expect(() => registry.register(orderPlacedV1)).toThrow(DuplicateEventDefinitionError);
    expect(() => createEventRegistry([invoiceIssued, invoiceIssued])).toThrow(
      'billing.invoice.issued v1',
    );
  });
});

describe('on', () => {
  it('hands the typed event to the handler', async () => {
    const bus = new InMemoryEventBus();
    const totals: number[] = [];
    const subscription = on(orderPlacedV1, async (event) => {
      totals.push(event.payload.total);
    });
    bus.subscribe(subscription.type, subscription.handler);

    await bus.publish([placedV1('evt-1')]);

    expect(subscription.type).toBe('ordering.order.placed');
    expect(totals).toEqual([30]);
  });

  it('skips another version of the same type', async () => {
    const bus = new InMemoryEventBus();
    const handled: string[] = [];
    subscribeAll(bus, [
      on(orderPlacedV1, async (event) => {
        handled.push(`v1:${event.id}`);
      }),
      on(orderPlacedV2, async (event) => {
        handled.push(`v2:${event.payload.customer.id}`);
      }),
    ]);

    await bus.publish([placedV1('evt-1')]);

    expect(handled).toEqual(['v1:evt-1']);
  });

  it('throws on an invalid payload so that the provider retries or dead-letters', async () => {
    const handled: string[] = [];
    const { handler } = on(orderPlacedV1, async (event) => {
      handled.push(event.id);
    });

    await expect(handler(rawEvent({ payload: { orderId: 7 } }))).rejects.toBeInstanceOf(
      InvalidEventPayloadError,
    );
    expect(handled).toEqual([]);
  });

  it('handles a redelivered event once per consumer when a store is given', async () => {
    const bus = new InMemoryEventBus();
    const processed = new InMemoryProcessedEventStore();
    const handled: string[] = [];
    const record = (consumer: string) =>
      on(orderPlacedV1, async (event) => void handled.push(`${consumer}:${event.id}`), {
        consumer,
        processed,
      });
    subscribeAll(bus, [record('billing'), record('shipping')]);

    await bus.publish([placedV1('evt-1'), placedV1('evt-1'), placedV1('evt-2')]);

    expect(handled).toEqual(['billing:evt-1', 'shipping:evt-1', 'billing:evt-2', 'shipping:evt-2']);
  });

  it('does not consume the idempotency key of an event it rejects or skips', async () => {
    const processed = new InMemoryProcessedEventStore();
    const { handler } = on(orderPlacedV1, async () => undefined, { consumer: 'billing', processed });

    await handler(rawEvent({ id: 'evt-1', version: 2 }));
    await handler(rawEvent({ id: 'evt-2', payload: {} })).catch(() => undefined);

    expect(await processed.markProcessed('billing', 'evt-1')).toBe(true);
    expect(await processed.markProcessed('billing', 'evt-2')).toBe(true);
  });
});

describe('subscribeAll', () => {
  it('returns one subscription that removes every handler', async () => {
    const bus = new InMemoryEventBus();
    const handled: string[] = [];
    const subscription = subscribeAll(bus, [
      on(orderPlacedV1, async (event) => void handled.push(event.id)),
      on(invoiceIssued, async (event) => void handled.push(event.id)),
    ]);
    const invoice = invoiceIssued.create(
      { invoiceId: 'inv-1', orderId: 'order-1' },
      { id: 'evt-2', occurredAt: at },
    );

    await bus.publish([placedV1('evt-1'), invoice]);
    subscription.unsubscribe();
    await bus.publish([placedV1('evt-3'), invoice]);

    expect(handled).toEqual(['evt-1', 'evt-2']);
  });
});

describe('validatingPublisher', () => {
  const registry = createEventRegistry([orderPlacedV1, invoiceIssued]);

  it('lets declared, valid events through untouched', async () => {
    const bus = new InMemoryEventBus();
    const event = placedV1('evt-1');

    await validatingPublisher(bus, registry).publish([event]);

    expect(bus.published).toEqual([event]);
  });

  it('refuses an undeclared version by default and publishes nothing of the batch', async () => {
    const bus = new InMemoryEventBus();
    const publisher = validatingPublisher(bus, registry);

    await expect(
      publisher.publish([placedV1('evt-1'), rawEvent({ version: 2 })]),
    ).rejects.toBeInstanceOf(UnknownEventError);
    expect(bus.published).toEqual([]);
  });

  it('refuses a payload that does not match the declaration', async () => {
    const bus = new InMemoryEventBus();
    const publisher = validatingPublisher(bus, registry, { unknown: 'allow' });

    await expect(publisher.publish([rawEvent({ payload: { orderId: 'o' } })])).rejects.toMatchObject({
      code: 'INVALID_EVENT_PAYLOAD',
      issues: [{ path: 'total' }],
    });
    expect(bus.published).toEqual([]);
  });

  it('lets undeclared events through when asked to', async () => {
    const bus = new InMemoryEventBus();
    const unknown = rawEvent({ type: 'legacy.thing.happened', payload: 'anything' });

    await validatingPublisher(bus, registry, { unknown: 'allow' }).publish([unknown]);

    expect(bus.published).toEqual([unknown]);
  });
});
