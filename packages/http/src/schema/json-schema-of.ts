import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';

const described = new WeakMap<Schema<unknown>, JsonSchema>();

/**
 * The JSON Schema of a schema, computed once: a route is answered many times, and some libraries
 * rebuild the description of every class they know each time they are asked.
 */
export function jsonSchemaOf(schema: Schema<unknown>): JsonSchema {
  const known = described.get(schema);

  if (known !== undefined) {
    return known;
  }

  const computed = schema.toJsonSchema();

  described.set(schema, computed);

  return computed;
}
