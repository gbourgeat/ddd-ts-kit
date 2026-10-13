import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ok } from '@ddd-ts-kit/kernel';
import { customSchema, schemaBehind, sharedNameOf, sharedSchema } from '../src/index.js';
import { zodSchema } from '../src/zod.js';

const slot = customSchema((input) => ok(input), {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: { startsAt: { type: 'string', format: 'date-time' }, place: { $ref: '#/$defs/Place' } },
  $defs: { Place: { type: 'string' } },
});

describe('a shared schema', () => {
  it('describes itself as a reference to its own definition, carrying the definitions it needs', () => {
    expect(sharedSchema('Slot', slot).toJsonSchema()).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: '#/$defs/Slot',
      $defs: {
        Place: { type: 'string' },
        Slot: {
          type: 'object',
          properties: { startsAt: { type: 'string', format: 'date-time' }, place: { $ref: '#/$defs/Place' } },
        },
      },
    });
  });

  it('validates as the schema it shares', () => {
    expect(sharedSchema('Slot', slot).parse({ startsAt: 'now' })).toEqual(ok({ startsAt: 'now' }));
  });

  it('names the schema it was built from, so what another package attached to it holds for it too', () => {
    const shared = sharedSchema('Slot', slot);

    expect(schemaBehind.of(shared)).toBe(slot);
    expect(schemaBehind.of(slot)).toBeUndefined();
  });

  it('is told by its name, and a schema that is not shared has none', () => {
    expect(sharedNameOf(sharedSchema('Slot', slot).toJsonSchema())).toBe('Slot');
    expect(sharedNameOf(slot.toJsonSchema())).toBeUndefined();
    expect(sharedNameOf({ $ref: '#/$defs/Missing', $defs: {} })).toBeUndefined();
    expect(sharedNameOf({ $ref: '#/components/schemas/Slot' })).toBeUndefined();
  });

  it('keeps a zod schema registered under the same id as zod describes it', () => {
    const registered = z.object({ startsAt: z.string() }).meta({ id: 'RegisteredSlot' });
    const described = zodSchema(registered).toJsonSchema();

    expect(sharedSchema('RegisteredSlot', zodSchema(registered)).toJsonSchema()).toEqual(described);
    expect(sharedNameOf(described)).toBe('RegisteredSlot');
  });

  it('moves draft-07 definitions next to its own', () => {
    const legacy = customSchema((input) => ok(input), { type: 'object', definitions: { Old: { type: 'string' } } });

    expect(sharedSchema('Legacy', legacy).toJsonSchema()).toEqual({
      $ref: '#/$defs/Legacy',
      $defs: { Old: { type: 'string' }, Legacy: { type: 'object' } },
    });
  });

  it('refuses a name an OpenAPI component cannot have', () => {
    expect(() => sharedSchema('2 slots', slot)).toThrow(/cannot name a shared schema/);
  });
});
