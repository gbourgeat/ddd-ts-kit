import type { DeclaredClass } from '../model/declared-class.js';
import type { Token } from '../token/token.js';

/*
 * One map per process, whatever the number of copies of this package it loaded, as the
 * registry of declarations: the generated file of a context and the container that reads it
 * may not share a copy.
 */
const INJECTED = Symbol.for('@ddd-ts-kit/kernel/injected/v1');

export function injectedRegistry(): WeakMap<DeclaredClass, readonly Token<unknown>[]> {
  const existing: unknown = Reflect.get(globalThis, INJECTED);

  if (isInjectedRegistry(existing)) {
    return existing;
  }

  const created = new WeakMap<DeclaredClass, readonly Token<unknown>[]>();

  Reflect.set(globalThis, INJECTED, created);

  return created;
}

function isInjectedRegistry(value: unknown): value is WeakMap<DeclaredClass, readonly Token<unknown>[]> {
  return value instanceof WeakMap;
}
