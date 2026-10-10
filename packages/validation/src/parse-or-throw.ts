import type { Schema } from './schema.js';
import { ValidationError } from './validation-error.js';

export function parseOrThrow<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.parse(input);

  if (result.ok) {
    return result.value;
  }

  throw new ValidationError(result.error);
}
