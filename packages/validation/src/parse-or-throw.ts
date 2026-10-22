import type { Schema } from './schema';
import { ValidationError } from './validation-error';

export function parseOrThrow<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.parse(input);

  if (result.ok) {
    return result.value;
  }

  throw new ValidationError(result.error);
}
