import type { AuditRecord, AuditTrail, ExecutionContext, PersonalDataCopy } from '@ddd-ts-kit/kernel';
import type { AuditSource } from './audit-source';
import { SUBJECT_ERASURE_ACTION } from './audited-subject-keys';
import { failureReason } from './failure-reason';
import { recordIn } from './record-in';

export interface AuditedPersonalDataErasureOptions extends AuditSource {
  /**
   * Told when the entry of a failed erasure could not be written: the caller receives the failure
   * of the erasure, not the one of its audit. The entry of an erasure that succeeded is not
   * optional: when it cannot be written, `erase` rejects with that error.
   */
  readonly onLostRecord?: (error: unknown, record: AuditRecord | undefined) => void;
}

/**
 * The erasure of a copy, with every run written to the trail, whatever asked for it: a script, a
 * command, a job, with an event store or without one. The entry has category `data-access`, action
 * `personal-data:erase`, the subject as resource of type `data-subject`, the name of the copy as
 * `context`, and says in `changes` how many rows were reached (`rows`), `0` included, never what
 * they held. It is what proves an erasure on a project whose aggregates are rows, where no key is
 * destroyed and `auditedSubjectKeys` has nothing to wrap: the actor of the work is the operator,
 * and the correlation id of the entry is the one the announcement of the erasure carries.
 *
 * The execution context is read first, so an erasure outside one is refused before any row is
 * touched; the rows are erased, then the entry is written. An entry never states an erasure that
 * did not happen. When it cannot be written, the erasure fails with that error, the rows are gone
 * all the same, and running it again records `rows: 0`. A failed erasure is recorded with the code
 * of its failure, then rethrown.
 */
export function auditedPersonalDataErasure(
  port: PersonalDataCopy,
  trail: AuditTrail,
  options: AuditedPersonalDataErasureOptions,
): PersonalDataCopy {
  return new AuditedPersonalDataErasure(port, trail, options);
}

class AuditedPersonalDataErasure implements PersonalDataCopy {
  readonly name: string;

  constructor(
    private readonly port: PersonalDataCopy,
    private readonly trail: AuditTrail,
    private readonly options: AuditedPersonalDataErasureOptions,
  ) {
    this.name = port.name;
  }

  async erase(subject: string): Promise<number> {
    const context = this.options.scope.require();
    const rows = await this.orRecordFailure(context, subject);

    await this.trail.record(this.recordOf(context, subject, { outcome: 'succeeded', changes: { rows } }));

    return rows;
  }

  private async orRecordFailure(context: ExecutionContext, subject: string): Promise<number> {
    try {
      return await this.port.erase(subject);
    } catch (error) {
      await this.recordFailure(context, subject, error);

      throw error;
    }
  }

  private async recordFailure(context: ExecutionContext, subject: string, failure: unknown): Promise<void> {
    let record: AuditRecord | undefined;

    try {
      record = this.recordOf(context, subject, { outcome: 'failed', reason: failureReason(failure) });
      await this.trail.record(record);
    } catch (error) {
      this.options.onLostRecord?.(error, record);
    }
  }

  private recordOf(
    context: ExecutionContext,
    subject: string,
    result: Pick<AuditRecord, 'outcome' | 'reason' | 'changes'>,
  ): AuditRecord {
    return recordIn(context, this.options, {
      category: 'data-access',
      action: SUBJECT_ERASURE_ACTION,
      resource: { type: 'data-subject', id: subject },
      context: this.port.name,
      ...result,
    });
  }
}
