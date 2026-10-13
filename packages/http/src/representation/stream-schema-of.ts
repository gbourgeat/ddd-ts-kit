import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema, parseOrThrow, type Schema } from '@ddd-ts-kit/validation';
import { isAsyncIterable } from '../support/is-async-iterable.js';

/**
 * The schema of a list a route answers as it reads it (an export), from the schema of one item:
 * the handler returns an `AsyncIterable`, every representation writes it chunk by chunk, and the
 * contract describes it as an array. What `parse` answers checks each item as it is read; the
 * pipeline, which writes what the handler returned, checks with `validateResponses` only that a
 * list was returned.
 */
export function streamSchemaOf<T>(item: Schema<T>): Schema<AsyncIterable<T>> {
  const { $schema: _dialect, $defs, definitions, ...itemSchema } = item.toJsonSchema();

  return customSchema(
    (input) =>
      isAsyncIterable(input)
        ? ok(checked(input, item))
        : err([{ path: '', code: 'invalid_stream', message: 'A list read as it comes is expected.' }]),
    {
      type: 'array',
      items: itemSchema,
      ...($defs === undefined ? {} : { $defs }),
      ...(definitions === undefined ? {} : { definitions }),
    },
  );
}

/** Each item through the schema as it is read: an item that does not match stops the list. */
async function* checked<T>(items: AsyncIterable<unknown>, schema: Schema<T>): AsyncIterable<T> {
  for await (const item of items) {
    yield parseOrThrow(schema, item);
  }
}
