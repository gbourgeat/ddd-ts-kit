import type {
  AuditRecord,
  AuditTrail,
  ExecutionContext,
  PersonalDataExport,
  PersonalDataRecord,
} from '@ddd-ts-kit/kernel';
import type { AuditSource } from './audit-source';
import { failureReason } from './failure-reason';
import { recordIn } from './record-in';

/** The action of the entry an export writes. */
export const PERSONAL_DATA_EXPORT_ACTION = 'personal-data:export';

export interface AuditedPersonalDataExportOptions extends AuditSource {
  /**
   * Told when the entry of a failed export could not be written: the caller receives the failure
   * of the export, not the one of its audit. The entry of an export that succeeded is not
   * optional: when it cannot be written, `exportOf` rejects with that error and hands nothing over.
   */
  readonly onLostRecord?: (error: unknown, record: AuditRecord | undefined) => void;
}

/**
 * The export of a context, with every handover written to the trail, whatever asked for it: a
 * script, a command, a job. The entry has category `data-access`, action `personal-data:export`,
 * the subject as resource of type `data-subject`, the name of the context as `context`, and says
 * in `changes` how many records were read (`records`), never what they hold: the trail is
 * append-only and may be read by many, the document goes to the person alone. The accountability
 * of article 5 asks for the proof that a request of access was answered, and to whom what was
 * read: this is it.
 *
 * The order is chosen: the actor is read first, and an export outside an execution context is
 * refused before any row is read; then the records are read, then the entry is written. The entry
 * is written before the records are handed over, so that no document leaves without its trace:
 * when the entry cannot be written, the export fails with that error, nothing was handed over, and
 * running it again reads the same rows and records them. A failed read is recorded with the code
 * of its failure, then rethrown.
 */
export function auditedPersonalDataExport(
  port: PersonalDataExport,
  trail: AuditTrail,
  options: AuditedPersonalDataExportOptions,
): PersonalDataExport {
  return new AuditedPersonalDataExport(port, trail, options);
}

class AuditedPersonalDataExport implements PersonalDataExport {
  readonly name: string;

  constructor(
    private readonly port: PersonalDataExport,
    private readonly trail: AuditTrail,
    private readonly options: AuditedPersonalDataExportOptions,
  ) {
    this.name = port.name;
  }

  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    const context = this.options.scope.require();
    const records = await this.orRecordFailure(context, subject);

    await this.trail.record(
      this.recordOf(context, subject, { outcome: 'succeeded', changes: { records: records.length } }),
    );

    return records;
  }

  private async orRecordFailure(context: ExecutionContext, subject: string): Promise<readonly PersonalDataRecord[]> {
    try {
      return await this.port.exportOf(subject);
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
      action: PERSONAL_DATA_EXPORT_ACTION,
      resource: { type: 'data-subject', id: subject },
      context: this.port.name,
      ...result,
    });
  }
}
