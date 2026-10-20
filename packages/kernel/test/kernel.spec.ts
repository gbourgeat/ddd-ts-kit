import { describe, expect, it } from 'vitest';
import {
  AggregateRoot,
  Entity,
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

class Price extends ValueObject<{ amount: number; currency: string }> {
  static of(amount: number, currency: string): Price {
    return new Price({ amount, currency });
  }
}

class Slot extends ValueObject<{
  startsAt: Date;
  attendees: readonly string[];
  place: Readonly<Record<string, string | number>> | null;
}> {
  static of(
    startsAt: Date,
    attendees: readonly string[],
    place: Readonly<Record<string, string | number>> | null,
  ): Slot {
    return new Slot({ startsAt, attendees, place });
  }
}

class Patient extends Entity {
  constructor(
    id: string,
    readonly name: string,
  ) {
    super(id);
  }
}

class Practitioner extends Entity {
  constructor(id: string) {
    super(id);
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

  it('is never equal to nothing, nor to a value object of another type holding the same values', () => {
    expect(Money.of(5, 'EUR').equals(undefined)).toBe(false);
    expect(Money.of(5, 'EUR').equals(null)).toBe(false);
    expect(Money.of(5, 'EUR').equals(Price.of(5, 'EUR'))).toBe(false);
  });

  it('compares instants by time, lists item by item and nested records key by key', () => {
    const slot = Slot.of(new Date('2026-10-01T08:00:00Z'), ['ada', 'grace'], { room: 'B', floor: 2 });

    expect(slot.equals(Slot.of(new Date('2026-10-01T08:00:00Z'), ['ada', 'grace'], { room: 'B', floor: 2 }))).toBe(
      true,
    );

    expect(slot.equals(Slot.of(new Date('2026-10-01T09:00:00Z'), ['ada', 'grace'], { room: 'B', floor: 2 }))).toBe(
      false,
    );

    expect(slot.equals(Slot.of(new Date('2026-10-01T08:00:00Z'), ['grace', 'ada'], { room: 'B', floor: 2 }))).toBe(
      false,
    );

    expect(slot.equals(Slot.of(new Date('2026-10-01T08:00:00Z'), ['ada'], { room: 'B', floor: 2 }))).toBe(false);
    expect(slot.equals(Slot.of(new Date('2026-10-01T08:00:00Z'), ['ada', 'grace'], { room: 'B' }))).toBe(false);

    expect(slot.equals(Slot.of(new Date('2026-10-01T08:00:00Z'), ['ada', 'grace'], { room: 'B', wing: 2 }))).toBe(
      false,
    );

    expect(slot.equals(Slot.of(new Date('2026-10-01T08:00:00Z'), ['ada', 'grace'], null))).toBe(false);
  });

  it('serializes as its values, which cannot be changed', () => {
    const money = Money.of(5, 'EUR');

    expect(JSON.stringify(money)).toBe('{"amount":5,"currency":"EUR"}');
    expect(Object.isFrozen(money.toJSON())).toBe(true);
  });
});

describe('Entity', () => {
  it('is equal to an entity of the same type and the same id, whatever else it holds', () => {
    expect(new Patient('p1', 'Ada').equals(new Patient('p1', 'Ada Lovelace'))).toBe(true);
    expect(new Patient('p1', 'Ada').equals(new Patient('p2', 'Ada'))).toBe(false);
  });

  it('is never equal to nothing, nor to an entity of another type with the same id', () => {
    expect(new Patient('p1', 'Ada').equals(undefined)).toBe(false);
    expect(new Patient('p1', 'Ada').equals(null)).toBe(false);
    expect(new Patient('p1', 'Ada').equals(new Practitioner('p1'))).toBe(false);
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

  it('wraps a single failure in an AggregateError by default', async () => {
    const bus = new InMemoryEventBus();
    const first = new Error('first');

    bus.subscribe('shop.cart.checked-out', async () => {
      throw first;
    });

    await expect(bus.publish([event('e1')])).rejects.toMatchObject({
      errors: [first],
      message: '1 event handler(s) failed',
    });
  });

  it('rethrows a single failure as it is when its failures are delivered as thrown', async () => {
    const bus = new InMemoryEventBus({ failures: 'as-thrown' });
    const conflict = Object.assign(new Error('the cart changed meanwhile'), { code: 'CONCURRENCY_CONFLICT' });
    let ran = false;

    bus.subscribe('shop.cart.checked-out', async () => {
      throw conflict;
    });

    bus.subscribe('shop.cart.checked-out', async () => void (ran = true));
    await expect(bus.publish([event('e1')])).rejects.toBe(conflict);
    expect(ran).toBe(true);
  });

  it('still rethrows several failures together, in the order the handlers ran, when delivered as thrown', async () => {
    const bus = new InMemoryEventBus({ failures: 'as-thrown' });
    const first = new Error('first');
    const second = new Error('second');

    bus.subscribe('shop.cart.checked-out', async () => {
      throw first;
    });

    bus.subscribe('shop.cart.checked-out', async () => {
      throw second;
    });

    const failure = await bus.publish([event('e1'), event('e2')]).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure).toMatchObject({ errors: [first, second, first, second], message: '4 event handler(s) failed' });
  });

  it('processes a redelivered event once per consumer', async () => {
    const bus = new InMemoryEventBus();
    let count = 0;

    bus.subscribe(
      'shop.cart.checked-out',
      idempotent('mailer', new InMemoryProcessedEventStore(), async () => void count++),
    );

    await bus.publish([event('e1'), event('e1')]);
    expect(count).toBe(1);
  });

  it('handles a redelivered event again when the first handling failed', async () => {
    const store = new InMemoryProcessedEventStore();
    let attempts = 0;

    const handler = idempotent('mailer', store, async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error('smtp down');
      }
    });

    await expect(handler(event('e1'))).rejects.toThrow('smtp down');
    await handler(event('e1'));
    await handler(event('e1'));

    expect(attempts).toBe(2);
  });
});
