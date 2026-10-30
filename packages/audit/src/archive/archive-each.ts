import type { AuditArchive } from './audit-archive';
import type { AuditArchiveReport } from './audit-archive-report';
import { AuditArchiveRefusedError, type AuditArchiveRefusal } from './audit-archive-refused-error';

/**
 * Archives chain after chain: one that does not verify keeps its entries and stops nothing but
 * itself, and the refusals are thrown together once every chain ran. Any other failure, a storage
 * that does not answer, ends the run where it is.
 */
export async function archiveEach(
  chains: readonly string[],
  archive: (chain: string) => Promise<AuditArchive | undefined>,
): Promise<AuditArchiveReport> {
  const archives: AuditArchive[] = [];
  const refusals: AuditArchiveRefusal[] = [];

  for (const chain of chains) {
    try {
      const archived = await archive(chain);

      if (archived !== undefined) {
        archives.push(archived);
      }
    } catch (error) {
      if (!(error instanceof AuditArchiveRefusedError)) {
        throw error;
      }

      refusals.push(...error.refusals);
    }
  }

  if (refusals.length > 0) {
    throw new AuditArchiveRefusedError(refusals, archives);
  }

  return { archives };
}
