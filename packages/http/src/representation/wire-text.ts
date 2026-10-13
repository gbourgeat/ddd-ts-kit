/**
 * The text of a scalar in every representation that is not JSON, by the rules JSON follows:
 * an instant in ISO 8601 UTC, a boolean as `true` or `false`, a number as JavaScript writes it,
 * a big integer in full. `undefined` for nothing (`null`, `undefined`) and for what is no scalar.
 */
export function wireText(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return undefined;
}
