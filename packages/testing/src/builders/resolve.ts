import { isResolvable } from './is-resolvable.js';
import { RESOLVE, type Resolvable } from './resolvable.js';

/** Builds the value when given a builder, returns it untouched otherwise. */
export function resolve<T>(value: T | Resolvable<T>): T {
  return isResolvable(value) ? value[RESOLVE]() : value;
}
