import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record.js';
import type { Definitions } from './definitions.js';

/** One OpenAPI parameter per property of the schema of a request part. */
export function schemaParameters(
  location: 'path' | 'query' | 'header',
  schema: Schema<unknown> | undefined,
  definitions: Definitions,
): JsonSchema[] {
  if (schema === undefined) {
    return [];
  }

  const embedded = definitions.embed(schema);
  const properties = embedded['properties'];

  if (!isRecord(properties)) {
    return [];
  }

  const required = Array.isArray(embedded['required']) ? embedded['required'] : [];

  return Object.entries(properties).map(([name, property]) => {
    const description = isRecord(property) ? property['description'] : undefined;

    return {
      name,
      in: location,
      ...(typeof description === 'string' ? { description } : {}),
      required: required.includes(name),
      schema: property,
    };
  });
}
