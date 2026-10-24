/**
 * What the platform does to an adapter once it is bound: tracing and the aspects wrap every method,
 * and a method that answers a thenable is read as asynchronous, its answer awaited and a promise
 * answered in its place. A helper that answered a query builder would be run, and its chain broken.
 */
export function boundInAnApplication<T extends object>(adapter: T): T {
  for (let owner: object | null = Reflect.getPrototypeOf(adapter); owner !== null && owner !== Object.prototype; ) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      const original: unknown = Reflect.get(adapter, name);

      if (name !== 'constructor' && typeof original === 'function') {
        Object.defineProperty(adapter, name, {
          value: (...args: unknown[]): unknown => {
            const result: unknown = original.apply(adapter, args);

            return typeof result === 'object' && result !== null && 'then' in result ? Promise.resolve(result) : result;
          },
          configurable: true,
          writable: true,
        });
      }
    }

    owner = Reflect.getPrototypeOf(owner);
  }

  return adapter;
}
