import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';
import type { Definitions } from './definitions';
import { schemaParameters } from './schema-parameters';

export function pathParameters(
  path: string,
  schema: Schema<unknown> | undefined,
  definitions: Definitions,
): JsonSchema[] {
  const described = new Map(
    schemaParameters('path', schema, definitions).map((parameter) => [parameter['name'], parameter]),
  );

  // The path is the authority on which parameters exist; the schema only refines their type.
  return [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => ({
    name: match[1],
    in: 'path',
    schema: { type: 'string' },
    ...described.get(match[1]),
    required: true,
  }));
}
