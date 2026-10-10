import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { standardSchema, type StandardSchemaV1 } from '../src/standard-schema.js';

const valibotOrder = v.object({
  customerId: v.pipe(v.string(), v.uuid()),
  items: v.pipe(
    v.array(v.object({ sku: v.pipe(v.string(), v.minLength(1)), quantity: v.pipe(v.number(), v.integer()) })),
    v.minLength(1),
  ),
});

describe('the Standard Schema adapter, with valibot', () => {
  const order = standardSchema(valibotOrder);

  it('returns the typed value', () => {
    const result = order.parse({
      customerId: '0b8f6e0e-2f4b-4c58-9c0e-6f1d2a3b4c5d',
      items: [{ sku: 'A-1', quantity: 2 }],
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      const quantity: number | undefined = result.value.items[0]?.quantity;

      expect(quantity).toBe(2);
    }
  });

  it('reports each issue with its dotted path', () => {
    const result = order.parse({ customerId: 'nope', items: [{ sku: '', quantity: 1.5 }] });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['customerId', 'items.0.sku', 'items.0.quantity']),
      );

      expect(result.error.every((issue) => issue.code === 'invalid' && issue.message !== '')).toBe(true);
    }
  });

  it('defaults the JSON Schema to the schema that accepts anything', () => {
    expect(order.toJsonSchema()).toEqual({});
  });

  it('exposes the JSON Schema supplied by the caller', () => {
    const described = standardSchema(valibotOrder, { type: 'object', required: ['customerId', 'items'] });

    expect(described.toJsonSchema()).toEqual({ type: 'object', required: ['customerId', 'items'] });
  });

  it('refuses a schema that validates asynchronously', () => {
    const asynchronous = v.objectAsync({
      sku: v.pipeAsync(
        v.string(),
        v.checkAsync(async () => true),
      ),
    });

    expect(() => standardSchema(asynchronous).parse({ sku: 'A-1' })).toThrow(
      /async schemas are not supported at the boundary/,
    );
  });
});

describe('the Standard Schema adapter, with a hand-written schema', () => {
  const even: StandardSchemaV1<unknown, number> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) =>
        typeof value === 'number' && value % 2 === 0
          ? { value }
          : { issues: [{ message: 'An even number is expected.', path: ['amount', { key: 'value' }] }] },
    },
  };

  it('accepts path segments given as keys or as objects', () => {
    expect(standardSchema(even).parse(3)).toEqual({
      ok: false,
      error: [{ path: 'amount.value', code: 'invalid', message: 'An even number is expected.' }],
    });

    expect(standardSchema(even).parse(4)).toEqual({ ok: true, value: 4 });
  });
});
