import type { Bound } from './symbol-of';

/** One text per symbol: two tables files that give the same one hold the same symbol. */
export function signatureOf({ value = '', type = '' }: Bound): string {
  return `${value}|${type}`;
}
