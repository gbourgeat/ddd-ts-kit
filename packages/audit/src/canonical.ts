import { createHash } from 'node:crypto';
import type { AuditEntry } from './entry.js';

/** The `previousHash` of the first entry of every chain. */
export const GENESIS_HASH = '0'.repeat(64);

export type UnsealedEntry = Omit<AuditEntry, 'hash'>;

/** SHA-256, in lower-case hexadecimal, of the canonical form of the entry without its `hash`. */
export function hashOf(entry: UnsealedEntry): string {
  const { hash: _hash, ...content }: UnsealedEntry & { readonly hash?: string } = entry;
  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex');
}

/**
 * The canonical form the hash is computed over, so that any program can compute it again:
 * JSON without whitespace, the keys of every object sorted by UTF-16 code unit (the order of
 * `Array.prototype.sort`), a property whose value is `undefined` left out, a date written in
 * ISO 8601 UTC with milliseconds, numbers and strings as `JSON.stringify` writes them.
 */
export function canonicalize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object' && value !== null) return canonicalObject(value);
  return JSON.stringify(value ?? null);
}

function canonicalObject(value: object): string {
  const members = Object.entries(value)
    .filter(([, member]) => member !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, member]) => `${JSON.stringify(key)}:${canonicalize(member)}`);
  return `{${members.join(',')}}`;
}
