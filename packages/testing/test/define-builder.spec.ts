import { beforeEach, describe, expect, it } from 'vitest';
import { defineBuilder, lazy, resetSequences, sequence } from '../src/index.js';
import { aCustomer, aLine } from './support/builders.js';
import type { Customer, Line } from './support/order.js';

beforeEach(() => {
  resetSequences();
});

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

describe('defineBuilder', () => {
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

describe('sequence and lazy, the defaults drawn at each build', () => {
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
});
