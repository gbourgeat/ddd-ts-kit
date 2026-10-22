import type { Token } from './token';

export function prototypeOf(target: Token<unknown>): object | undefined {
  const prototype: unknown = Reflect.get(target, 'prototype');

  return typeof prototype === 'object' && prototype !== null ? prototype : undefined;
}
