import type { AuditRecord, AuditTrail, ExecutionContext, PersonalDataRetention } from '@ddd-ts-kit/kernel';
import type { AuditSource } from './audit-source';
import { failureReason } from './failure-reason';
import { recordIn } from './record-in';

/** The action of the entry a purge writes. */
export const PERSONAL_DATA_PURGE_ACTION = 'personal-data:purge';

export interface AuditedPersonalDataRetentionOptions extends AuditSource {
  /**
   * Told when the entry of a failed purge could not be written: the caller receives the failure of
   * the purge, not the one of its audit. The entry of a purge that succeeded is not optional: when
   * it cannot be written, `purgeExpired` rejects with that error, and the next run records it.
   */
  readonly onLostRecord?: (error: unknown, record: AuditRecord | undefined) => void;
}

/**
 * The storage limitation of a context, with every purge written to the trail, the job of the
 * platform or a script: the entry has category `data-access`, action `personal-data:purge`, the
 * name of the context as `context`, and says in `changes` how many rows outlived their retention
 * and were erased (`rows`), `0` included: the proof that the retention is applied, run after run,
 * which the accountability of article 5(2) asks for. It names no person: a purge reaches rows by
 * their age, never by whom they are about.
 *
 * The execution context is read first, so a purge outside one is refused before any row is
 * touched; the rows are purged, then the entry is written. When it cannot be written, the purge
 * fails with that error; the rows are erased all the same, and the next run, reaching nothing,
 * records `rows: 0`. A failed purge is recorded with the code of its failure, then rethrown.
 */
export function auditedPersonalDataRetention(
  port: PersonalDataRetention,
  trail: AuditTrail,
  options: AuditedPersonalDataRetentionOptions,
): PersonalDataRetention {
  return new AuditedPersonalDataRetention(port, trail, options);
}

class AuditedPersonalDataRetention implements PersonalDataRetention {
  readonly name: string;

  constructor(
    private readonly port: PersonalDataRetention,
    private readonly trail: AuditTrail,
    private readonly options: AuditedPersonalDataRetentionOptions,
  ) {
    this.name = port.name;
  }

  async purgeExpired(now: Date): Promise<number> {
    const context = this.options.scope.require();
    const rows = await this.orRecordFailure(context, now);

    await this.trail.record(this.recordOf(context, { outcome: 'succeeded', changes: { rows } }));

    return rows;
  }

  private async orRecordFailure(context: ExecutionContext, now: Date): Promise<number> {
    try {
      return await this.port.purgeExpired(now);
    } catch (error) {
      await this.recordFailure(context, error);

      throw error;
    }
  }

  private async recordFailure(context: ExecutionContext, failure: unknown): Promise<void> {
    let record: AuditRecord | undefined;

    try {
      record = this.recordOf(context, { outcome: 'failed', reason: failureReason(failure) });
      await this.trail.record(record);
    } catch (error) {
      this.options.onLostRecord?.(error, record);
    }
  }

  private recordOf(
    context: ExecutionContext,
    result: Pick<AuditRecord, 'outcome' | 'reason' | 'changes'>,
  ): AuditRecord {
    return recordIn(context, this.options, {
      category: 'data-access',
      action: PERSONAL_DATA_PURGE_ACTION,
      context: this.port.name,
      ...result,
    });
  }
}
