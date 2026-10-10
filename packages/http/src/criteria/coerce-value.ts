import type { FieldType, FieldValue } from '@ddd-ts-kit/kernel';

const NUMBER = /^-?\d+(?:\.\d+)?$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

/**
 * A value of a query string as the type of its field reads it, `undefined` when it does not:
 * a number in plain digits, `true` or `false`, an ISO 8601 instant with its zone (or a date,
 * taken at midnight UTC), a decimal kept as written.
 */
export function coerceValue(type: FieldType, text: string): FieldValue | undefined {
  switch (type) {
    case 'string':
      return text;
    case 'number':
      return NUMBER.test(text) ? Number(text) : undefined;
    case 'decimal':
      return NUMBER.test(text) ? text : undefined;
    case 'boolean':
      return booleanOf(text);
    case 'instant':
      return instantOf(text);
  }
}

function booleanOf(text: string): boolean | undefined {
  return text === 'true' || text === 'false' ? text === 'true' : undefined;
}

function instantOf(text: string): Date | undefined {
  const instant = new Date(text);

  return INSTANT.test(text) && !Number.isNaN(instant.getTime()) ? instant : undefined;
}
