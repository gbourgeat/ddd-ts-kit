import { Readable } from 'node:stream';
import type { AuditEntry } from '@ddd-ts-kit/kernel';
import { verifyChain } from '../verify/verify-chain';
import type { ArchiveOptions } from './archive-options';
import { archiveKeyOf } from './archive-key-of';
import { archivedContent } from './archived-content';
import type { AuditArchive } from './audit-archive';
import { AuditArchiveNotStoredError } from './audit-archive-not-stored-error';
import { AuditArchiveRefusedError } from './audit-archive-refused-error';
import { storedDigest } from './stored-digest';

/**
 * Verifies the entries of a range from the anchor of the archive before it, writes them to their
 * file, reads the file back and checks its digest, and answers the archive to record: the store
 * records it, then removes the entries, in one transaction. A file that does not read back as it
 * was written is refused (`AuditArchiveNotStoredError`) before anything is removed. The file is written first: a transaction that fails after it leaves a file no
 * archive names, which the next run writes again under the same key.
 */
export async function archiveOf(
  chain: string,
  entries: readonly AuditEntry[],
  { previous, options }: { readonly previous: AuditArchive | undefined; readonly options: ArchiveOptions },
): Promise<AuditArchive | undefined> {
  const first = entries[0];
  const last = entries.at(-1);

  if (first === undefined || last === undefined) {
    return undefined;
  }

  const after =
    previous === undefined ? {} : { after: { chain, sequence: previous.toSequence, hash: previous.lastHash } };

  const verification = await verifyChain(entries, { chain, from: first.sequence, ...after });

  if (!verification.valid) {
    throw new AuditArchiveRefusedError([{ chain, chainBreak: verification.break }]);
  }

  const { text, digest } = archivedContent(entries);
  const fileKey = archiveKeyOf(chain, first.sequence, last.sequence);

  await options.files.put(fileKey, Readable.from([Buffer.from(text, 'utf8')]), { mediaType: 'application/x-ndjson' });

  if ((await storedDigest(options.files, fileKey)) !== digest) {
    throw new AuditArchiveNotStoredError(chain, fileKey);
  }

  return {
    chain,
    fromSequence: first.sequence,
    toSequence: last.sequence,
    lastHash: last.hash,
    entries: entries.length,
    fileKey,
    fileDigest: digest,
    archivedAt: options.clock.now(),
  };
}
