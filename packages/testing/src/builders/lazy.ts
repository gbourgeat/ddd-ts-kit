import { RESOLVE, type Resolvable } from './resolvable.js';

/** A default computed at each `build()`, for values that must not be shared between tests. */
export function lazy<T>(produce: () => T): Resolvable<T> {
  return new Lazy(produce);
}

class Lazy<T> implements Resolvable<T> {
  constructor(private readonly produce: () => T) {}

  [RESOLVE](): T {
    return this.produce();
  }
}
