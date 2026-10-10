import { err, ok, type Result } from '@ddd-ts-kit/kernel';
import { formatPath } from '../format-path.js';
import type { JsonSchema } from '../json-schema.js';
import type { Schema } from '../schema.js';
import type { ValidationIssue } from '../validation-issue.js';
import type { InferStandardOutput } from './infer-standard-output.js';
import type { StandardSchemaIssue, StandardSchemaResult, StandardSchemaV1 } from './standard-schema-v1.js';

/**
 * Standard Schema has no JSON Schema export, so the contract side is supplied by the caller
 * and defaults to `{}` (any value).
 */
export function standardSchema<S extends StandardSchemaV1>(
  schema: S,
  jsonSchema: JsonSchema = {},
): Schema<InferStandardOutput<S>> {
  return {
    parse(input) {
      const result = schema['~standard'].validate(input);

      if (result instanceof Promise) {
        // The verdict is discarded, its rejection must not surface as unhandled.
        result.catch(() => undefined);

        throw new Error(
          `The "${schema['~standard'].vendor}" schema validates asynchronously: async schemas are not supported at the boundary.`,
        );
      }

      return verdictOf(result);
    },
    toJsonSchema: () => jsonSchema,
  };
}

function verdictOf<Output>(result: StandardSchemaResult<Output>): Result<Output, ValidationIssue[]> {
  if (result.issues === undefined) {
    return ok(result.value);
  }

  return err(result.issues.map(issueOf));
}

function issueOf(issue: StandardSchemaIssue): ValidationIssue {
  const segments = (issue.path ?? []).map((segment) => (typeof segment === 'object' ? segment.key : segment));

  // The specification carries no machine-readable code.
  return { path: formatPath(segments), code: 'invalid', message: issue.message };
}
