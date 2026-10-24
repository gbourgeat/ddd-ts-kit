import type { PersonalDataValue } from './personal-data-value';

/** The value of a column as an export writes it: a scalar as it is, an instant as ISO text, nothing as `null`, anything else as JSON text. */
export function personalDataValueOf(value: unknown): PersonalDataValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (isScalar(value)) {
    return value;
  }

  return value instanceof Date ? value.toISOString() : textOf(value);
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** A record or a list as JSON, a bigint as digits; a function or a symbol has no value to export, its kind stands for it. */
function textOf(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  return typeof value === 'object' && value !== null ? JSON.stringify(value) : typeof value;
}
