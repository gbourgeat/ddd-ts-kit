/** A list read as it comes (a cursor, a stream of rows), which a representation writes chunk by chunk. */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}
