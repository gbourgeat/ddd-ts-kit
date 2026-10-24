import type { ArchiveOptions } from './archive-options';
import type { AuditArchive } from './audit-archive';
import type { AuditArchiveReport } from './audit-archive-report';

/**
 * A trail whose oldest entries leave the database for the file storage, verified and anchored
 * (GDPR article 5(1)(e) for the identifiers the entries keep, and the size of the trail): the
 * stores of the package and `InMemoryAuditTrail` implement it.
 */
export interface ArchivableAuditTrail {
  /**
   * Writes, chain by chain, the entries older than `before` to one file each, verified first, then
   * removes them: the chain goes on from the hash of the last one, kept in the archive. A chain
   * that does not verify is refused (`AuditArchiveRefusedError`) and keeps its entries.
   */
  archiveBefore(before: Date, options: ArchiveOptions): Promise<AuditArchiveReport>;

  /** The archives of a chain, oldest first: the anchor to verify the entries left from is the last one. */
  archivesOf(chain: string): Promise<readonly AuditArchive[]>;
}
