import type { Method } from './method';

/**
 * A sealed or frozen instance cannot receive own methods, so it is fronted by a proxy.
 * Methods and getters run with the real instance as `this`: a proxy is not the object a
 * built-in (a `Map`, a `Date`) or a class with hard-private members accepts as receiver.
 */
export function proxied<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  const bound = new Map<string, Method>();

  for (const [name, wrapper] of wrappers) {
    bound.set(name, function (this: unknown, ...args: unknown[]): unknown {
      return wrapper.apply(this === proxy ? instance : this, args);
    });
  }

  const proxy: T = new Proxy(instance, {
    get(target, property) {
      const method = typeof property === 'string' ? bound.get(property) : undefined;

      return method ?? Reflect.get(target, property, target);
    },
  });

  return proxy;
}
