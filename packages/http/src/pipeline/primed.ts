/**
 * The same items, the first one already read: a cursor that cannot open fails here, while the
 * request can still be answered with a problem, rather than after the status was sent. Closing
 * the list closes the cursor, read or not.
 */
export async function primed<T>(items: AsyncIterable<T>): Promise<AsyncIterable<T>> {
  const iterator = items[Symbol.asyncIterator]();
  let first: IteratorResult<T> | undefined = await iterator.next();

  return {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        const read = first ?? (await iterator.next());

        first = undefined;

        return read;
      },
      return: async (value?: unknown) => {
        first = undefined;

        return (await iterator.return?.(value)) ?? { done: true, value: undefined };
      },
    }),
  };
}
