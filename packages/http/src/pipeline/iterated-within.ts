/** What runs a piece of work inside the scope of a request: its execution context, its principal. */
export type Within = <T>(work: () => Promise<T>) => Promise<T>;

/**
 * The same items, each one read inside the scope of the request: a list streamed after its
 * handler returned is read by the adapter, which still sees who acts, the tenant and the
 * correlation of the request.
 */
export function iteratedWithin<T>(items: AsyncIterable<T>, within: Within): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: () => {
      const iterator = items[Symbol.asyncIterator]();

      return {
        next: () => within(() => iterator.next()),
        return: async (value?: unknown) =>
          (await within(async () => iterator.return?.(value))) ?? { done: true, value: undefined },
      };
    },
  };
}
