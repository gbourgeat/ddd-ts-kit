import type { AuditReader, FileStorage } from '@ddd-ts-kit/kernel';
import type { ArchivableAuditTrail } from '../archive/archivable-audit-trail';
import type { AuditArchive } from '../archive/audit-archive';
import { storedText } from '../archive/stored-text';
import { verifyArchive } from '../archive/verify-archive';
import type { ChainHead } from '../chain/chain-head';
import type { ChainBreak } from './chain-break';
import type { ChainVerification } from './chain-verification';
import type { TrailVerification } from './trail-verification';
import type { VerifyTrailOptions } from './verify-trail-options';
import { verifyChain, type VerifyChainOptions } from './verify-chain';

/**
 * Verifies every chain of the trail, each from its last archive to its head: the entries left in
 * the trail link to the anchor the last archive kept, and the chain reaches the sequence and the
 * hash its head says, so a chain cut at its tail does not verify. Given the storage of the files,
 * the last archive is proved against its file first, so an archive row is not taken on its word.
 * Each chain stops at its own break and the others are verified all the same. The head is read
 * before the entries: what is appended meanwhile waits for the next verification.
 */
export async function verifyTrail(
  trail: AuditReader & ArchivableAuditTrail,
  options: VerifyTrailOptions = {},
): Promise<TrailVerification> {
  const breaks: ChainBreak[] = [];
  let checked = 0;

  for (const head of await trail.chainHeads()) {
    const outcome = await verifyOneChain(trail, head, options.files);

    checked += outcome.checked;

    if (!outcome.valid) {
      breaks.push(outcome.break);
    }
  }

  return { valid: breaks.length === 0, checked, breaks };
}

async function verifyOneChain(
  trail: AuditReader & ArchivableAuditTrail,
  head: ChainHead,
  files: FileStorage | undefined,
): Promise<ChainVerification> {
  const archives = await trail.archivesOf(head.chain);
  const [last, previous] = [archives.at(-1), archives.at(-2)];
  const failed = last === undefined || files === undefined ? undefined : await unproved(files, last, previous);

  return failed === undefined
    ? verifyChain(trail, fromTheArchive(head, last))
    : { valid: false, checked: 0, break: failed };
}

function fromTheArchive(head: ChainHead, last: AuditArchive | undefined): VerifyChainOptions {
  const { chain, sequence } = head;
  const range = { chain, to: sequence, checkpoints: [head] };

  return last === undefined ? range : { ...range, after: { chain, sequence: last.toSequence, hash: last.lastHash } };
}

/** Where an archive does not hold: its file is gone, or does not prove the row that names it. */
async function unproved(
  files: FileStorage,
  archive: AuditArchive,
  previous: AuditArchive | undefined,
): Promise<ChainBreak | undefined> {
  const text = await storedText(files, archive.fileKey);
  const { chain, fromSequence } = archive;

  if (text === undefined) {
    return { kind: 'missing-entry', chain, position: 0, sequence: fromSequence };
  }

  const proof = provenBy(text, archive, previous);

  return proof.valid
    ? undefined
    : { kind: 'altered-content', chain, position: 0, sequence: proof.sequence ?? fromSequence };
}

function provenBy(
  text: string,
  archive: AuditArchive,
  previous: AuditArchive | undefined,
): { readonly valid: boolean; readonly sequence?: number } {
  try {
    return verifyArchive(text, archive, previous);
  } catch {
    // A line that is not JSON under the digest the row records: the row describes no archive the trail wrote.
    return { valid: false };
  }
}
