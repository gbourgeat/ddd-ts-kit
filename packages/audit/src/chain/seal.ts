import type { AuditEntry, AuditRecord } from '@ddd-ts-kit/kernel';
import type { ChainHead } from './chain-head';
import { hashOf } from './hash-of';

/** The entry that follows `head`: its position, the link to the entry before it and its hash. */
export function seal(record: AuditRecord, head: ChainHead): AuditEntry {
  const unsealed = {
    ...record,
    extensions: record.extensions ?? {},
    chain: head.chain,
    sequence: head.sequence + 1,
    previousHash: head.hash,
  };

  return Object.freeze({ ...unsealed, hash: hashOf(unsealed) });
}
