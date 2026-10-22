import type { Result } from '@ddd-ts-kit/kernel';
import type { JsonSchema } from './json-schema';
import type { Schema } from './schema';
import type { ValidationIssue } from './validation-issue';

/** Builds a schema from a plain function, for hand-written checks and for tests. */
export function customSchema<T>(
  parse: (input: unknown) => Result<T, ValidationIssue[]>,
  jsonSchema: JsonSchema = {},
): Schema<T> {
  return { parse, toJsonSchema: () => jsonSchema };
}
