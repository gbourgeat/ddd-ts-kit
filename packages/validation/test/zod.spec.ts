import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '../src/zod';

const order = zodSchema(
  z.object({
    customerId: z.string().uuid(),
    note: z.string().max(200).optional(),
    priority: z.enum(['low', 'high']).default('low'),
    items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  }),
);

describe('the zod adapter', () => {
  it('returns the typed value, defaults applied', () => {
    const result = order.parse({
      customerId: '0b8f6e0e-2f4b-4c58-9c0e-6f1d2a3b4c5d',
      items: [{ sku: 'A-1', quantity: 2 }],
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      const quantity: number | undefined = result.value.items[0]?.quantity;

      expect(quantity).toBe(2);
      expect(result.value.priority).toBe('low');
    }
  });

  it('reports each issue with its dotted path', () => {
    const result = order.parse({ customerId: 'nope', items: [{ sku: '', quantity: 1.5 }] });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      const paths = result.error.map((issue) => issue.path);

      expect(paths).toEqual(expect.arrayContaining(['customerId', 'items.0.sku', 'items.0.quantity']));

      for (const issue of result.error) {
        expect(issue.code).not.toBe('');
        expect(issue.message).not.toBe('');
      }
    }
  });

  it('reports an empty path when the input itself has the wrong type', () => {
    const result = order.parse('not an object');

    expect(result).toMatchObject({ ok: false, error: [{ path: '', code: 'invalid_type' }] });
  });

  it('describes the input side as a draft 2020-12 JSON Schema', () => {
    const schema = order.toJsonSchema();

    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        customerId: { type: 'string', format: 'uuid' },
        note: { type: 'string', maxLength: 200 },
        priority: { type: 'string', enum: ['low', 'high'], default: 'low' },
        items: {
          type: 'array',
          minItems: 1,
          items: { type: 'object', required: ['sku', 'quantity'] },
        },
      },
    });

    // A field with a default is optional for the client.
    expect(schema['required']).toEqual(['customerId', 'items']);
  });

  it('describes the output side on request', () => {
    const schema = zodSchema(z.object({ priority: z.string().default('low') }), { io: 'output' });

    expect(schema.toJsonSchema()['required']).toEqual(['priority']);
  });

  it('does not fail on a type JSON Schema cannot represent', () => {
    expect(() => zodSchema(z.object({ at: z.date() })).toJsonSchema()).not.toThrow();
  });
});
