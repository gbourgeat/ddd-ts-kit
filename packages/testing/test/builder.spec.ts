import { beforeEach, describe, expect, it } from 'vitest';
import { Builder, lazy, resetSequences, resolve, type Defaults } from '../src';
import { aCustomer, aLine, anOrder } from './support/builders';
import { EmptyOrder, Order } from './support/order';

beforeEach(() => {
  resetSequences();
});

describe('Builder (class form)', () => {
  it('reads in the ubiquitous language and builds through the aggregate', () => {
    const order = anOrder()
      .identifiedBy('order-42')
      .placedBy(aCustomer().named('Ada'))
      .withLine(aLine().with('quantity', 2))
      .paid()
      .build();

    expect(order).toBeInstanceOf(Order);

    expect(order.toSnapshot()).toEqual({
      id: 'order-42',
      customer: { id: 'customer-1', name: 'Ada' },
      lines: [
        { sku: 'sku-1', quantity: 1 },
        { sku: 'sku-2', quantity: 2 },
      ],
      status: 'paid',
    });
  });

  it('keeps the subclass and its immutability through every step', () => {
    const placed = anOrder();
    const paid = placed.paid();
    const bigger = paid.withLine(aLine()).withLine(aLine());

    expect(placed.build().status).toBe('placed');
    expect(paid.build().toSnapshot().lines).toHaveLength(1);
    expect(bigger.build().toSnapshot().lines).toHaveLength(3);
    expect(bigger.build().status).toBe('paid');
  });

  it('cannot build an aggregate the domain refuses', () => {
    expect(() => anOrder().withoutLines().build()).toThrow(EmptyOrder);
  });

  it('says why it cannot add to a list that is only known at build time', () => {
    class BasketBuilder extends Builder<{ skus: string[] }, { skus: string[] }> {
      protected defaults(): Defaults<{ skus: string[] }> {
        return { skus: lazy(() => ['book']) };
      }

      protected construct(props: { skus: string[] }): { skus: string[] } {
        return props;
      }

      containing(sku: string): this {
        return this.adding('skus', sku);
      }
    }

    expect(() => new BasketBuilder().containing('pen')).toThrow('adding("skus") needs the current value to be a list');
  });

  it('offers a second output from the same vocabulary, for the level that speaks HTTP', () => {
    const order = anOrder().placedBy(aCustomer().named('Ada')).withLine(aLine().with('sku', 'pen'));

    expect(order.buildRequest()).toEqual({
      customerId: 'customer-1',
      lines: [
        { sku: 'sku-1', quantity: 1 },
        { sku: 'pen', quantity: 1 },
      ],
    });

    expect(order.build()).toBeInstanceOf(Order);
  });

  it('builds many distinct aggregates', () => {
    const orders = anOrder().buildMany(3);

    expect(orders.map((order) => order.id)).toEqual(['order-1', 'order-2', 'order-3']);
  });

  it('is itself a value another builder or `resolve` can build', () => {
    expect(resolve(aCustomer().named('Ada'))).toEqual({ id: 'customer-1', name: 'Ada' });
    expect(resolve({ id: 'c', name: 'Plain' })).toEqual({ id: 'c', name: 'Plain' });
  });
});
