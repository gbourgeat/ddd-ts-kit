import type { AuditEntry } from '@ddd-ts-kit/kernel';
import type { ChainHead } from './chain-head';

export function headAfter(entry: AuditEntry): ChainHead {
  return { chain: entry.chain, sequence: entry.sequence, hash: entry.hash };
}
