import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '@ddd-ts-kit/kernel';
import { collectEvents } from '../src/e2e.js';
import { orderPlaced } from './support/order-placed.js';

describe('collectEvents, on a bus of its own', () => {
  it('filters by type, given as a name or as a declaration carrying one', async () => {
    const bus = new InMemoryEventBus();
    const OrderPaid = { type: 'ordering.order.paid' };
    const events = collectEvents(bus, ['ordering.order.placed', OrderPaid]);

    await bus.publish([
      { ...orderPlaced({ id: 'order-1' }), type: 'ordering.order.paid' },
      orderPlaced({ id: 'order-2' }),
      { ...orderPlaced({ id: 'order-3' }), type: 'shipping.parcel.sent' },
    ]);

    expect(events.received().map((event) => event.id)).toEqual(['event-order-1', 'event-order-2']);
    expect(events.received(OrderPaid).map((event) => event.id)).toEqual(['event-order-1']);
    expect((await events.waitFor(OrderPaid)).id).toBe('event-order-1');
  });

  it('stops recording once stopped', async () => {
    const bus = new InMemoryEventBus();
    const events = collectEvents(bus, ['ordering.order.placed']);

    events.stop();
    await bus.publish([orderPlaced({ id: 'order-1' })]);

    expect(events.received()).toEqual([]);
  });

  it('says what it received when the awaited event never comes', async () => {
    const bus = new InMemoryEventBus();
    const events = collectEvents(bus, ['ordering.order.placed']);

    await bus.publish([orderPlaced({ id: 'order-1' })]);

    const waiting = events.waitFor('ordering.order.placed', (event) => event.id === 'event-order-9', {
      timeoutMs: 30,
      intervalMs: 5,
    });

    await expect(waiting).rejects.toThrow(
      'Still failing after 30 ms: No "ordering.order.placed" event matched; 1 of that type received',
    );
  });

  it('refuses to wait for a type it does not collect', () => {
    const events = collectEvents(new InMemoryEventBus(), ['ordering.order.placed']);

    expect(() => events.waitFor('ordering.order.paid')).toThrow('"ordering.order.paid" is not collected');
  });
});
