import type { Method } from './method';

/** The instance with the wrappers as own methods, in front of the ones of its class. */
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
