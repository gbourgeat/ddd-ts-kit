import type { Result } from '@ddd-ts-kit/kernel';
import type { JsonSchema } from './json-schema';
import type { ValidationIssue } from './validation-issue';

/**
 * The contract every validation library is adapted to. Presentation code depends on this
 * interface only, so the library can be swapped without touching routes. A schema is a value
 * handed to what validates with it, one per input: it is never bound in a container.
 */
export interface Schema<T> {
  parse(input: unknown): Result<T, ValidationIssue[]>;

  toJsonSchema(): JsonSchema;
}
