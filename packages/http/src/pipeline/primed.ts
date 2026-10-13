/**
 * The same items, the first one already read: a cursor that cannot open fails here, while the
 * request can still be answered with a problem, rather than after the status was sent.
 */
export async function primed<T>(items: AsyncIterable<T>): Promise<AsyncIterable<T>> {
  const iterator = items[Symbol.asyncIterator]();
  const first = await iterator.next();

  return {
    async *[Symbol.asyncIterator]() {
      if (first.done === true) {
        return;
      }

      yield first.value;

      for (let next = await iterator.next(); next.done !== true; next = await iterator.next()) {
        yield next.value;
      }
    },
  };
}
