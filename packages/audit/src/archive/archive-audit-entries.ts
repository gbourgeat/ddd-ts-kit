import type { Clock, FileStorage, ScheduledJob } from '@ddd-ts-kit/kernel';
import type { ArchivableAuditTrail } from './archivable-audit-trail';

/** A year online: the reviews of a year read the trail without its archives. */
const A_YEAR = 12;

/**
 * The scheduled job of the platform that archives the entries of the trail older than the whole
 * months it keeps online (twelve by default), counted from the first day of the current month in
 * UTC: each run moves whole months, and a run missed is caught up by the next. Registered under
 * `audit.archive`, on the first day of every month, by the platform of a project that keeps its
 * trail in a database and its files in a storage.
 */
export class ArchiveAuditEntries implements ScheduledJob {
  constructor(
    private readonly trail: ArchivableAuditTrail,
    private readonly files: FileStorage,
    private readonly clock: Clock,
    private readonly monthsOnline: number = A_YEAR,
  ) {
    if (!Number.isInteger(monthsOnline) || monthsOnline < 1) {
      throw new RangeError(`The trail keeps at least one whole month online, not ${String(monthsOnline)}`);
    }
  }

  async run(): Promise<void> {
    await this.trail.archiveBefore(this.before(), { files: this.files, clock: this.clock });
  }

  /** The first instant of the oldest month kept online. */
  private before(): Date {
    const now = this.clock.now();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - this.monthsOnline, 1));
  }
}
