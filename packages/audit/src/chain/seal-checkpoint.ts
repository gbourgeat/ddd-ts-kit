import type { AuditEntry } from '@ddd-ts-kit/kernel';
import type { SealingOptions } from './sealing-options.js';

export async function sealCheckpoint(entry: AuditEntry, sealing: SealingOptions | undefined): Promise<void> {
  if (sealing === undefined || entry.sequence % sealing.every !== 0) return;

  await sealing.onSeal({ chain: entry.chain, sequence: entry.sequence, hash: entry.hash });
}
