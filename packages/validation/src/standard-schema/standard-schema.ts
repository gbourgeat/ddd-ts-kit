import { err, ok, type Result } from '@ddd-ts-kit/kernel';
import { formatPath } from '../format-path';
import type { JsonSchema } from '../json-schema';
import type { Schema } from '../schema';
import type { ValidationIssue } from '../validation-issue';
import type { InferStandardOutput } from './infer-standard-output';
import type { StandardSchemaOptions } from './standard-schema-options';
import type { StandardSchemaIssue, StandardSchemaResult, StandardSchemaV1 } from './standard-schema-v1';

/**
 * Validates with any Standard Schema library. The JSON Schema of the contract is the one given;
 * without it, the one the library converts itself when it implements Standard JSON Schema
 * (verified with zod 4), else `{}` (any value). A schema the library cannot write as JSON Schema
 * (a date, a custom check) is documented `{}` as well, never a failure of the contract.
 */
export function standardSchema<S extends StandardSchemaV1>(
  schema: S,
  jsonSchema?: JsonSchema,
  options: StandardSchemaOptions = {},
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
    toJsonSchema: () => jsonSchema ?? converted(schema, options),
  };
}

function converted(schema: StandardSchemaV1, { io = 'input' }: StandardSchemaOptions): JsonSchema {
  const converter = schema['~standard'].jsonSchema;

  if (converter === undefined) {
    return {};
  }

  try {
    return converter[io]({ target: 'draft-2020-12' });
  } catch {
    return {};
  }
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
