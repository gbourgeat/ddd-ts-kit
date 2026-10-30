import type { AuditEntry, AuditRecord } from '@ddd-ts-kit/kernel';
import type { ChainHead } from './chain-head';
import { hashOf } from './hash-of';
import { wellFormed } from './well-formed';

/**
 * The entry that follows `head`: its position, the link to the entry before it and its hash,
 * computed over the entry as a store keeps it, whatever text the record holds.
 */
export function seal(record: AuditRecord, head: ChainHead): AuditEntry {
  const unsealed = wellFormed({
    ...record,
    extensions: record.extensions ?? {},
    chain: head.chain,
    sequence: head.sequence + 1,
    previousHash: head.hash,
  });

  return Object.freeze({ ...unsealed, hash: hashOf(unsealed) });
}
