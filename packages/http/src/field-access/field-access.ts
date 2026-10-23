import { schemaBehind, type Schema } from '@ddd-ts-kit/validation';
import type { FieldAccessEntry } from './field-access-entry';

interface Registry {
  readonly fields: WeakMap<Schema<unknown>, readonly FieldAccessEntry[]>;
}

/*
 * One registry per process, whatever the number of copies of this package it loaded, as the
 * presentation registry: the global symbol registry is what they all share.
 */
const REGISTRY = Symbol.for('@ddd-ts-kit/http/field-access/v1');

/**
 * The restricted fields of a schema: those `withFieldAccess` marked, those of the items of a page
 * or a stream, and those of the schema it was built from (`sharedSchema` over a marked schema).
 */
export const fieldAccess = {
  of(schema: Schema<unknown> | undefined): readonly FieldAccessEntry[] {
    if (schema === undefined) {
      return [];
    }

    return registry().fields.get(schema) ?? fieldAccess.of(schemaBehind.of(schema));
  },

  /** What a schema built from another one (a page, a stream) carries of it, under `prefix`. */
  carry(from: Schema<unknown>, to: Schema<unknown>, prefix: readonly string[]): void {
    const entries = fieldAccess.of(from);

    if (entries.length > 0) {
      registry().fields.set(
        to,
        entries.map(({ path, rule }) => ({ path: [...prefix, ...path], rule })),
      );
    }
  },

  mark(schema: Schema<unknown>, entries: readonly FieldAccessEntry[]): void {
    registry().fields.set(schema, entries);
  },
};

function registry(): Registry {
  const existing: unknown = Reflect.get(globalThis, REGISTRY);

  if (isRegistry(existing)) {
    return existing;
  }

  const created: Registry = { fields: new WeakMap() };

  Reflect.set(globalThis, REGISTRY, created);

  return created;
}

function isRegistry(value: unknown): value is Registry {
  return typeof value === 'object' && value !== null && 'fields' in value && value.fields instanceof WeakMap;
}
