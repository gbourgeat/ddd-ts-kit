import { describe, expect, it } from 'vitest';
import { AggregateRoot } from '../src';

interface OrderSnapshot {
  readonly id: string;
  readonly sku: string;
  readonly shipped: boolean;
}

class Order extends AggregateRoot {
  private shipped = false;

  private constructor(
    id: string,
    readonly sku: string,
  ) {
    super(id);
  }

  static place(id: string, sku: string): Order {
    const order = new Order(id, sku);

    order.record({ name: 'shop.order.placed', aggregateId: id, occurredAt: new Date(0) });

    return order;
  }

  static rehydrate(snapshot: OrderSnapshot): Order {
    const order = new Order(snapshot.id, snapshot.sku);

    order.shipped = snapshot.shipped;

    return order;
  }

  ship(): void {
    this.shipped = true;
    this.record({ name: 'shop.order.shipped', aggregateId: this.id, occurredAt: new Date(0) });
  }

  get isShipped(): boolean {
    return this.shipped;
  }
}

describe('the events an aggregate has yet to announce', () => {
  it('are no part of what compares: same state, different pending events, equal', () => {
    const shippedNow = Order.place('o1', 'book');
    const loadedShipped = Order.rehydrate({ id: 'o1', sku: 'book', shipped: true });

    shippedNow.ship();

    expect(shippedNow).toEqual(loadedShipped);
    expect(shippedNow).toStrictEqual(loadedShipped);
    expect(loadedShipped.pullEvents()).toEqual([]);
    expect(shippedNow.pullEvents()).toHaveLength(2);
  });

  it('are not serialised, spread or listed', () => {
    const order = Order.place('o1', 'book');

    expect(JSON.stringify(order)).toBe('{"id":"o1","version":0,"sku":"book","shipped":false}');
    expect({ ...order }).toEqual({ id: 'o1', sku: 'book', version: 0, shipped: false });
    expect(Object.keys(order)).not.toContain('events');
  });

  it('are still handed over once, in the order they were recorded', () => {
    const order = Order.place('o1', 'book');

    order.ship();

    expect(order.pullEvents().map((event) => event.name)).toEqual(['shop.order.placed', 'shop.order.shipped']);
    expect(order.pullEvents()).toEqual([]);

    order.ship();

    expect(order.pullEvents().map((event) => event.name)).toEqual(['shop.order.shipped']);
  });

  it('leave the fields a subclass adds as they were: enumerable, compared and serialised', () => {
    const book = Order.rehydrate({ id: 'o1', sku: 'book', shipped: false });
    const pen = Order.rehydrate({ id: 'o1', sku: 'pen', shipped: false });

    expect(Object.keys(book)).toEqual(['id', 'version', 'sku', 'shipped']);
    expect(book).not.toEqual(pen);
    expect(book.isShipped).toBe(false);
  });
});
