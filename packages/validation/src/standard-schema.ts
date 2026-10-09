import { err, ok } from '@ddd-ts-kit/kernel';
import { formatPath, type JsonSchema, type Schema } from './index.js';

/** The subset of the Standard Schema v1 specification this adapter relies on. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaIssue[] };

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

export type InferStandardOutput<S extends StandardSchemaV1> = NonNullable<
  S['~standard']['types']
>['output'];

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
      if (result.issues === undefined) {
        return ok(result.value);
      }
      return err(
        result.issues.map((issue) => ({
          path: formatPath(
            (issue.path ?? []).map((segment) =>
              typeof segment === 'object' ? segment.key : segment,
            ),
          ),
          // The specification carries no machine-readable code.
          code: 'invalid',
          message: issue.message,
        })),
      );
    },
    toJsonSchema: () => jsonSchema,
  };
}
