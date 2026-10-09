import { describe, expect, it } from 'vitest';
import {
  AggregateRoot,
  InMemoryEventBus,
  InMemoryProcessedEventStore,
  ValueObject,
  err,
  idempotent,
  ok,
  unwrap,
  type IntegrationEvent,
} from '../src/index.js';

class Money extends ValueObject<{ amount: number; currency: string }> {
  static of(amount: number, currency: string): Money {
    return new Money({ amount, currency });
  }
}

class Cart extends AggregateRoot {
  constructor(id: string) {
    super(id);
  }
  checkout(): void {
    this.record({ name: 'shop.cart.checked-out', aggregateId: this.id, occurredAt: new Date(0) });
  }
}

const event = (id: string): IntegrationEvent => ({
  id,
  type: 'shop.cart.checked-out',
  version: 1,
  occurredAt: new Date(0).toISOString(),
  payload: {},
});

describe('ValueObject', () => {
  it('compares by value and by type', () => {
    expect(Money.of(5, 'EUR').equals(Money.of(5, 'EUR'))).toBe(true);
    expect(Money.of(5, 'EUR').equals(Money.of(6, 'EUR'))).toBe(false);
  });
});

describe('AggregateRoot', () => {
  it('hands recorded events over exactly once', () => {
    const cart = new Cart('c1');
    cart.checkout();
    expect(cart.pullEvents()).toHaveLength(1);
    expect(cart.pullEvents()).toHaveLength(0);
  });
});

describe('Result', () => {
  it('unwraps Ok and throws on Err', () => {
    expect(unwrap(ok(1))).toBe(1);
    expect(() => unwrap(err(new Error('boom')))).toThrow('boom');
  });
});

describe('InMemoryEventBus', () => {
  it('delivers to subscribers and keeps the published log', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe('shop.cart.checked-out', async (e) => void seen.push(e.id));
    await bus.publish([event('e1')]);
    expect(seen).toEqual(['e1']);
    expect(bus.published).toHaveLength(1);
  });

  it('runs every handler even when one fails, then reports all failures', async () => {
    const bus = new InMemoryEventBus();
    let ran = false;
    bus.subscribe('shop.cart.checked-out', async () => {
      throw new Error('first');
    });
    bus.subscribe('shop.cart.checked-out', async () => void (ran = true));
    await expect(bus.publish([event('e1')])).rejects.toBeInstanceOf(AggregateError);
    expect(ran).toBe(true);
  });

  it('processes a redelivered event once per consumer', async () => {
    const bus = new InMemoryEventBus();
    let count = 0;
    bus.subscribe('shop.cart.checked-out', idempotent('mailer', new InMemoryProcessedEventStore(), async () => void count++));
    await bus.publish([event('e1'), event('e1')]);
    expect(count).toBe(1);
  });
});
