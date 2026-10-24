import { createHash } from 'node:crypto';
import { canonicalize } from '../chain/canonicalize';
import { GENESIS_HASH } from '../chain/genesis-hash';
import type { ArchiveVerification } from './archive-verification';
import type { AuditArchive } from './audit-archive';

/**
 * Verifies the file of an archive as it was read back from the file storage: its digest is the one
 * recorded, it holds the range recorded, every entry seals its content and links to the one
 * before, the first to the last entry of the archive before it (or to the genesis), and the last
 * has the hash the trail goes on from. What the archive proves is then what the trail proved
 * before the entries left it: who did what, when, in what order, unaltered.
 */
export function verifyArchive(
  text: string,
  archive: AuditArchive,
  previous?: Pick<AuditArchive, 'toSequence' | 'lastHash'>,
): ArchiveVerification {
  if (createHash('sha256').update(text, 'utf8').digest('hex') !== archive.fileDigest) {
    return { valid: false, reason: 'digest' };
  }

  const entries = text
    .split('\n')
    .filter((line) => line !== '')
    .map((line): unknown => JSON.parse(line));

  if (
    entries.length !== archive.entries ||
    (previous?.toSequence ?? archive.fromSequence - 1) !== archive.fromSequence - 1
  ) {
    return { valid: false, reason: 'range' };
  }

  return linked(entries, archive, previous?.lastHash ?? GENESIS_HASH);
}

function linked(entries: readonly unknown[], archive: AuditArchive, anchor: string): ArchiveVerification {
  let previousHash = anchor;

  for (const [position, entry] of entries.entries()) {
    const sequence = archive.fromSequence + position;
    const record: object = new Object(entry);
    const hash: unknown = Reflect.get(record, 'hash');

    if (
      typeof hash !== 'string' ||
      Reflect.get(record, 'chain') !== archive.chain ||
      Reflect.get(record, 'sequence') !== sequence ||
      Reflect.get(record, 'previousHash') !== previousHash ||
      hash !== sealOf(record)
    ) {
      return { valid: false, reason: 'chain', sequence };
    }

    previousHash = hash;
  }

  return previousHash === archive.lastHash
    ? { valid: true, entries: entries.length }
    : { valid: false, reason: 'anchor' };
}

/** The hash of an entry as `hashOf` computes it: SHA-256 of the canonical form without its `hash`. */
function sealOf(entry: object): string {
  const content = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'hash'));

  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex');
}
