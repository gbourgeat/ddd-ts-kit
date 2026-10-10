import type { Method } from './method.js';

/** The instance itself, its traced methods defined over the ones it had or inherited. */
export function shadowed<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  for (const [name, wrapper] of wrappers) {
    const own = Object.getOwnPropertyDescriptor(instance, name);

    Object.defineProperty(instance, name, {
      value: wrapper,
      writable: true,
      configurable: true,
      enumerable: own?.enumerable ?? false,
    });
  }

  return instance;
}
