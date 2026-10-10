import { createHash } from 'node:crypto';
import type { AuditEntry } from '@ddd-ts-kit/kernel';
import { canonicalize } from './canonicalize.js';

export type UnsealedEntry = Omit<AuditEntry, 'hash'>;

/** SHA-256, in lower-case hexadecimal, of the canonical form of the entry without its `hash`. */
export function hashOf(entry: UnsealedEntry): string {
  const { hash: _hash, ...content }: UnsealedEntry & { readonly hash?: string } = entry;

  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex');
}
