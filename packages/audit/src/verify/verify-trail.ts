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
 * Verifies every chain of the trail, each from its last archive to its head. The archives of a
 * chain follow each other without a gap, and the head goes on from the last one: a head behind
 * it, or at its end with another hash, is a break. Given the storage of the files, every archive
 * is read back and proved by `verifyArchive` against the one before it, so a row is not taken on
 * its word, and a storage that fails is the break of that chain alone (`unreadable-archive`). Then
 * the entries left in the trail link to the anchor of the last archive and reach the sequence and
 * the hash of the head, so a chain cut at its tail does not verify. Each chain stops at its own
 * break and the others are verified all the same. The head is read before the entries: what is
 * appended meanwhile waits for the next verification.
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
  const failed = archivesBreak(archives, head) ?? (files === undefined ? undefined : await unproved(files, archives));

  return failed === undefined
    ? verifyChain(trail, fromTheArchive(head, archives.at(-1)))
    : { valid: false, checked: 0, break: failed };
}

/** Where the rows of the archives do not hold together, or the head does not go on from the last of them. */
function archivesBreak(archives: readonly AuditArchive[], head: ChainHead): ChainBreak | undefined {
  const { chain } = head;

  for (const [position, archive] of archives.entries()) {
    const expected = (archives[position - 1]?.toSequence ?? 0) + 1;

    if (archive.fromSequence !== expected) {
      return { kind: 'missing-entry', chain, position: 0, sequence: expected };
    }
  }

  const last = archives.at(-1);

  if (last === undefined || head.sequence > last.toSequence) {
    return undefined;
  }

  return head.sequence < last.toSequence || head.hash !== last.lastHash
    ? { kind: 'altered-content', chain, position: 0, sequence: head.sequence }
    : undefined;
}

function fromTheArchive(head: ChainHead, last: AuditArchive | undefined): VerifyChainOptions {
  const { chain, sequence } = head;
  const range = { chain, to: sequence, checkpoints: [head] };

  return last === undefined ? range : { ...range, after: { chain, sequence: last.toSequence, hash: last.lastHash } };
}

/** The first archive of the chain whose file does not prove its row, read back in their order. */
async function unproved(files: FileStorage, archives: readonly AuditArchive[]): Promise<ChainBreak | undefined> {
  for (const [position, archive] of archives.entries()) {
    const failed = await unprovedOne(files, archive, archives[position - 1]);

    if (failed !== undefined) {
      return failed;
    }
  }

  return undefined;
}

/** Where an archive does not hold: its file cannot be read, is gone, or does not prove the row that names it. */
async function unprovedOne(
  files: FileStorage,
  archive: AuditArchive,
  previous: AuditArchive | undefined,
): Promise<ChainBreak | undefined> {
  const { chain, fromSequence } = archive;
  const read = await readBack(files, archive.fileKey);

  if (read.failed) {
    return { kind: 'unreadable-archive', chain, position: 0, sequence: fromSequence };
  }

  if (read.text === undefined) {
    return { kind: 'missing-entry', chain, position: 0, sequence: fromSequence };
  }

  const proof = provenBy(read.text, archive, previous);

  return proof.valid
    ? undefined
    : { kind: 'altered-content', chain, position: 0, sequence: proof.sequence ?? fromSequence };
}

async function readBack(
  files: FileStorage,
  key: string,
): Promise<{ readonly failed: boolean; readonly text?: string | undefined }> {
  try {
    return { failed: false, text: await storedText(files, key) };
  } catch {
    // The storage answered with an error: the archive is unproved, and the other chains are verified all the same.
    return { failed: true };
  }
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
