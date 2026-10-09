import { beforeEach, describe, expect, it } from 'vitest';
import {
  Builder,
  defineBuilder,
  lazy,
  resetSequences,
  resolve,
  sequence,
  type Defaults,
} from '../src/index.js';
import { aCustomer, aLine, anOrder } from './support/builders.js';
import { EmptyOrder, Order, type Customer, type Line } from './support/order.js';

beforeEach(() => {
  resetSequences();
});

describe('defineBuilder', () => {
  interface Parcel {
    readonly id: string;
    readonly weight: number;
    readonly recipient: Customer;
    readonly contents: readonly Line[];
    readonly note?: string;
  }
  const aParcel = defineBuilder<Parcel>({
    defaults: { id: sequence('parcel'), weight: 1, recipient: aCustomer(), contents: [] },
  });

  it('builds from valid defaults declared once', () => {
    expect(aParcel().build()).toEqual({
      id: 'parcel-1',
      weight: 1,
      recipient: { id: 'customer-1', name: 'Grace Hopper' },
      contents: [],
    });
  });

  it('overrides one property with `with` and several with `withMany`', () => {
    const parcel = aParcel().with('weight', 12).withMany({ id: 'parcel-x', note: 'fragile' }).build();

    expect(parcel).toMatchObject({ id: 'parcel-x', weight: 12, note: 'fragile' });
  });

  it('returns a new builder at each step, so a shared base never leaks', () => {
    const base = aParcel().with('weight', 5);
    const heavy = base.with('weight', 50);

    expect(heavy).not.toBe(base);
    expect(base.build().weight).toBe(5);
    expect(heavy.build().weight).toBe(50);
    expect(aParcel().build().weight).toBe(1);
  });

  it('accepts a nested builder wherever a value is accepted, in arrays too', () => {
    const parcel = aParcel()
      .with('recipient', aCustomer().named('Ada'))
      .with('contents', [aLine().with('sku', 'book'), { sku: 'pen', quantity: 3 }, aLine()])
      .build();

    expect(parcel.recipient.name).toBe('Ada');
    expect(parcel.contents).toEqual([
      { sku: 'book', quantity: 1 },
      { sku: 'pen', quantity: 3 },
      { sku: 'sku-1', quantity: 1 },
    ]);
  });

  it('draws a fresh sequence value at each build, and none when the value is given', () => {
    expect(aParcel().buildMany(2).map((parcel) => parcel.id)).toEqual(['parcel-1', 'parcel-2']);
    expect(aParcel().with('id', 'fixed').build().id).toBe('fixed');
    expect(aParcel().build().id).toBe('parcel-3');
  });

  it('restarts the sequences on resetSequences', () => {
    aParcel().build();
    resetSequences();

    expect(aParcel().build().id).toBe('parcel-1');
  });

  it('formats a sequence and evaluates lazy defaults at each build', () => {
    let calls = 0;
    const aTicket = defineBuilder<{ number: number; openedAt: Date; tags: string[] }>({
      defaults: {
        number: sequence('ticket', (n) => 1000 + n),
        openedAt: lazy(() => new Date(Date.UTC(2026, 0, (calls += 1)))),
        tags: lazy(() => []),
      },
    });

    const [first, second] = aTicket().buildMany(2);

    expect(first?.number).toBe(1001);
    expect(second?.number).toBe(1002);
    expect(second?.openedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(first?.tags).not.toBe(second?.tags);
  });

  it('customizes each item of buildMany', () => {
    const parcels = aParcel().buildMany(3, (parcel, index) => parcel.with('weight', index * 10));

    expect(parcels.map((parcel) => parcel.weight)).toEqual([0, 10, 20]);
  });

  it('creates the output through the given factory', () => {
    const aTotal = defineBuilder<{ lines: readonly Line[] }, number>({
      defaults: { lines: [aLine(), aLine().with('quantity', 4)] },
      build: ({ lines }) => lines.reduce((sum, line) => sum + line.quantity, 0),
    });

    expect(aTotal().build()).toBe(5);
  });

  it('takes defaults as a function when they must be recomputed', () => {
    let version = 0;
    const aDocument = defineBuilder<{ version: number }>({
      defaults: () => ({ version: (version += 1) }),
    });

    expect(aDocument().buildMany(2)).toEqual([{ version: 1 }, { version: 2 }]);
  });
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
