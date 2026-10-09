import { DomainError, type Result } from '@ddd-ts-kit/kernel';

/** `path` is dotted (`items.0.sku`); the empty string designates the input itself. */
export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type JsonSchema = Record<string, unknown>;

/**
 * The port every validation library is adapted to. Presentation code depends on this
 * interface only, so the library can be swapped without touching routes.
 */
export interface Schema<T> {
  parse(input: unknown): Result<T, ValidationIssue[]>;
  toJsonSchema(): JsonSchema;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[], message = 'The input is not valid.') {
    super(message);
    this.issues = issues;
  }
}

export function parseOrThrow<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.parse(input);
  if (result.ok) {
    return result.value;
  }
  throw new ValidationError(result.error);
}

/** Joins path segments the way every adapter reports them. */
export function formatPath(segments: readonly PropertyKey[]): string {
  return segments.map((segment) => String(segment)).join('.');
}

/** Builds a schema from a plain function, for hand-written checks and for tests. */
export function customSchema<T>(
  parse: (input: unknown) => Result<T, ValidationIssue[]>,
  jsonSchema: JsonSchema = {},
): Schema<T> {
  return { parse, toJsonSchema: () => jsonSchema };
}
