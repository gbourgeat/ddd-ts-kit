import { describe, expect, it } from 'vitest';
import Type from 'typebox';
import { sharedNameOf } from '../src/index.js';
import { typeboxSchema } from '../src/typebox.js';

const slot = Type.Object(
  { startsAt: Type.String({ format: 'date-time' }), length: Type.Integer({ minimum: 5, default: 30 }) },
  { $id: 'Slot' },
);

const booking = Type.Object({ patientId: Type.String({ minLength: 1 }), slot });

describe('the TypeBox adapter', () => {
  it('returns the value with its defaults filled and the undeclared properties dropped', () => {
    expect(
      typeboxSchema(booking).parse({ patientId: 'p-1', slot: { startsAt: '2026-10-13T09:00:00Z' }, admin: true }),
    ).toEqual({ ok: true, value: { patientId: 'p-1', slot: { startsAt: '2026-10-13T09:00:00Z', length: 30 } } });
  });

  it('reports each failed keyword at its dotted path', () => {
    const result = typeboxSchema(booking).parse({ patientId: '', slot: { startsAt: 'soon', length: 1 } });

    expect(result).toMatchObject({
      ok: false,
      error: expect.arrayContaining([
        expect.objectContaining({ path: 'patientId', code: 'minLength' }),
        expect.objectContaining({ path: 'slot.startsAt', code: 'format' }),
        expect.objectContaining({ path: 'slot.length', code: 'minimum' }),
      ]),
    });
  });

  it('converts text to the declared types when asked, for path parameters and query strings', () => {
    const page = Type.Object({ limit: Type.Integer() });

    expect(typeboxSchema(page).parse({ limit: '20' }).ok).toBe(false);
    expect(typeboxSchema(page, { coerce: true }).parse({ limit: '20' })).toEqual({ ok: true, value: { limit: 20 } });
  });

  it('documents a schema built with an $id once, under $defs, wherever it is nested', () => {
    expect(typeboxSchema(booking).toJsonSchema()).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['patientId', 'slot'],
      properties: { patientId: { type: 'string', minLength: 1 }, slot: { $ref: '#/$defs/Slot' } },
      $defs: {
        Slot: {
          type: 'object',
          required: ['startsAt', 'length'],
          properties: {
            startsAt: { type: 'string', format: 'date-time' },
            length: { type: 'integer', minimum: 5, default: 30 },
          },
        },
      },
    });
  });

  it('is shared under its own $id, and a part of it is a shape of its own', () => {
    expect(sharedNameOf(typeboxSchema(slot).toJsonSchema())).toBe('Slot');
    expect(sharedNameOf(typeboxSchema(Type.Pick(slot, ['startsAt'])).toJsonSchema())).toBeUndefined();
  });

  it('reads a path segment escaped by JSON Pointer', () => {
    const odd = Type.Object({ 'a/b': Type.String() });

    expect(typeboxSchema(odd).parse({ 'a/b': 1 })).toMatchObject({ ok: false, error: [{ path: 'a/b' }] });
  });
});
