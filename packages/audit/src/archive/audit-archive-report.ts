import type { AuditArchive } from './audit-archive';

/** What an archiving did: one archive per chain that had entries older than the date, none for the others. */
export interface AuditArchiveReport {
  readonly archives: readonly AuditArchive[];
}
