import { compareDecimals } from './compare-decimals';
import type { FieldType } from './field-type';

/**
 * The order of two values of a field, neither being `null`: negative, zero or positive.
 * Numbers by value, instants by time, decimals as numbers, `false` before `true`, strings by
 * Unicode code point (`'B' < 'a'`), which is the `"C"` collation of PostgreSQL.
 */
export function compareValues(type: FieldType, left: unknown, right: unknown): number {
  if (type === 'decimal') {
    return compareDecimals(String(left), String(right));
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }

  return compareCodePoints(String(left), String(right));
}

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const b = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  const differing = a.findIndex((point, index) => point !== b[index]);

  if (differing === -1) {
    return a.length - b.length;
  }

  return differing >= b.length ? 1 : (a[differing] ?? 0) - (b[differing] ?? 0);
}
