import type { AuditEntry } from './audit-entry';

/** What a source hands to the trail. The trail gives it a chain, a position and its hashes. */
export type AuditRecord = Omit<AuditEntry, 'chain' | 'sequence' | 'previousHash' | 'hash' | 'extensions'> &
  Partial<Pick<AuditEntry, 'extensions'>>;
