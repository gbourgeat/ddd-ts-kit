import type { Schema } from '../schema.js';

interface Registry {
  readonly wrapped: WeakMap<Schema<unknown>, Schema<unknown>>;
}

/*
 * One registry per process, whatever the number of copies of this package it loaded: the global
 * symbol registry is what they all share.
 */
const REGISTRY = Symbol.for('@ddd-ts-kit/validation/schema-behind/v1');

/**
 * The schema another one was built from and validates with unchanged, as `sharedSchema` documents
 * a schema under a name: what a package attached to the first one (the fields `withFieldAccess`
 * of `@ddd-ts-kit/http` reserves) still holds for the second.
 */
export const schemaBehind = {
  of(schema: Schema<unknown>): Schema<unknown> | undefined {
    return registry().wrapped.get(schema);
  },

  record(wrapper: Schema<unknown>, wrapped: Schema<unknown>): void {
    registry().wrapped.set(wrapper, wrapped);
  },
};

function registry(): Registry {
  const existing: unknown = Reflect.get(globalThis, REGISTRY);

  if (isRegistry(existing)) {
    return existing;
  }

  const created: Registry = { wrapped: new WeakMap() };

  Reflect.set(globalThis, REGISTRY, created);

  return created;
}

function isRegistry(value: unknown): value is Registry {
  return typeof value === 'object' && value !== null && 'wrapped' in value && value.wrapped instanceof WeakMap;
}
