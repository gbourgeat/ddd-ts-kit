import type { AuditReader, FileStorage, ScheduledJob } from '@ddd-ts-kit/kernel';
import type { ArchivableAuditTrail } from '../archive/archivable-audit-trail';
import { AuditTrailBrokenError } from './audit-trail-broken-error';
import { verifyTrail } from './verify-trail';

/**
 * The scheduled job of the platform that verifies every chain of the trail, each from its last
 * archive to its head (`verifyTrail`), and fails with an `AuditTrailBrokenError` naming each
 * break: the scheduler logs a failed run and counts it, which is the alarm. Given the storage
 * the archives are written to, the last archive of each chain is proved against its file first.
 * Registered under `audit.verify`, every night, by the platform of a project whose trail is on.
 */
export class VerifyAuditTrail implements ScheduledJob {
  constructor(
    private readonly trail: AuditReader & ArchivableAuditTrail,
    private readonly files?: FileStorage,
  ) {}

  async run(): Promise<void> {
    const { breaks } = await verifyTrail(this.trail, this.files === undefined ? {} : { files: this.files });

    if (breaks.length > 0) {
      throw new AuditTrailBrokenError(breaks);
    }
  }
}
