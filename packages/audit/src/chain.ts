import { GENESIS_HASH, hashOf } from './canonical.js';
import type { AuditEntry, AuditRecord } from './entry.js';

/** The last entry of a chain, which the next one links to. */
export interface ChainHead {
  readonly chain: string;
  /** 0 for a chain that holds no entry yet. */
  readonly sequence: number;
  readonly hash: string;
}

export function emptyChain(chain: string): ChainHead {
  return { chain, sequence: 0, hash: GENESIS_HASH };
}

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

export function headAfter(entry: AuditEntry): ChainHead {
  return { chain: entry.chain, sequence: entry.sequence, hash: entry.hash };
}

/** A position of a chain and the hash it had there, to publish where the store cannot write. */
export interface AuditCheckpoint {
  readonly chain: string;
  readonly sequence: number;
  readonly hash: string;
}

export interface SealingOptions {
  /** A checkpoint is handed over each time the sequence of a chain is a multiple of it. */
  readonly every: number;
  /**
   * Runs when the entry is written, inside the unit of work when there is one: appending the
   * checkpoint to an outbox there makes it commit with the entry. A hook that calls a remote
   * service directly may anchor an entry whose transaction rolls back afterwards.
   */
  onSeal(checkpoint: AuditCheckpoint): void | Promise<void>;
}

export async function sealCheckpoint(entry: AuditEntry, sealing: SealingOptions | undefined): Promise<void> {
  if (sealing === undefined || entry.sequence % sealing.every !== 0) return;
  await sealing.onSeal({ chain: entry.chain, sequence: entry.sequence, hash: entry.hash });
}
