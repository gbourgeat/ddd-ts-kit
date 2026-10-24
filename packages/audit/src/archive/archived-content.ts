import { createHash } from 'node:crypto';
import type { AuditEntry } from '@ddd-ts-kit/kernel';
import { canonicalize } from '../chain/canonicalize';

/** The file of an archive: one canonical JSON per entry and per line, and its SHA-256. */
export function archivedContent(entries: readonly AuditEntry[]): { readonly text: string; readonly digest: string } {
  const text = entries.map((entry) => `${canonicalize(entry)}\n`).join('');

  return { text, digest: createHash('sha256').update(text, 'utf8').digest('hex') };
}
