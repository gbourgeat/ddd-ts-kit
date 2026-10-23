import { isDeepStrictEqual } from 'node:util';
import { show } from './show';

/** Where `actual` differs from the properties `expected` names, one line each: a plain object of `expected` is a subset. */
export function subsetDifferences(actual: unknown, expected: unknown, path: string): string[] {
  if (isPlainObject(expected) && typeof actual === 'object' && actual !== null) {
    return Object.entries(expected).flatMap(([key, value]) => {
      // Reflect.get rather than a spread: an event class may expose a property through a getter.
      const recorded: unknown = Reflect.get(actual, key);

      return subsetDifferences(recorded, value, `${path}.${key}`);
    });
  }

  return isDeepStrictEqual(actual, expected) ? [] : [`${path}: expected ${show(expected)}, recorded ${show(actual)}`];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
