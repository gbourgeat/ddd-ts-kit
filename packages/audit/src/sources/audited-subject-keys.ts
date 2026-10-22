import type { AuditRecord, AuditTrail, ExecutionContext, SubjectKey, SubjectKeyStore } from '@ddd-ts-kit/kernel';
import { UNEXPECTED_ERROR } from './audit-middleware.js';
import type { AuditSource } from './audit-source.js';
import { recordIn } from './record-in.js';

/** The action of the entry an erasure writes. */
export const SUBJECT_ERASURE_ACTION = 'personal-data:erase';

export interface AuditedSubjectKeysOptions extends AuditSource {
  /**
   * Told when the entry of a failed erasure could not be written. The caller receives the
   * failure of the erasure, never the failure of its audit.
   */
  readonly onLostRecord?: (error: unknown, record: AuditRecord | undefined) => void;
}

/**
 * The keys of the data subjects, with every erasure written to the trail, whatever asked for it:
 * a script, a command, a job. The entry has category `data-access`, action
 * `personal-data:erase`, the subject as resource of type `data-subject`, and says in `changes`
 * whether a key was destroyed (`keyDestroyed`). `keyFor` and `find` pass through.
 *
 * The keys and the trail share no transaction, so the order is chosen: the actor is read first,
 * and an erasure outside an execution context is refused before any key is touched; then the
 * key is destroyed, then the entry is written. An entry never states an erasure that did not
 * happen, and its date is never before the destruction. When the entry cannot be written, the
 * erasure fails with that error: run it again, it finds no key left and records that, at a
 * later date, which only delays the instant the erasure is said to be complete.
 */
export function auditedSubjectKeys(
  keys: SubjectKeyStore,
  trail: AuditTrail,
  options: AuditedSubjectKeysOptions,
): SubjectKeyStore {
  return new AuditedSubjectKeyStore(keys, trail, options);
}

class AuditedSubjectKeyStore implements SubjectKeyStore {
  constructor(
    private readonly keys: SubjectKeyStore,
    private readonly trail: AuditTrail,
    private readonly options: AuditedSubjectKeysOptions,
  ) {}

  keyFor(subject: string): Promise<SubjectKey> {
    return this.keys.keyFor(subject);
  }

  find(keyId: string): Promise<SubjectKey | undefined> {
    return this.keys.find(keyId);
  }

  async erase(subject: string): Promise<boolean> {
    const context = this.options.scope.require();
    const erased = await this.orRecordFailure(context, subject);

    await this.trail.record(
      this.recordOf(context, subject, { outcome: 'succeeded', changes: { keyDestroyed: erased } }),
    );

    return erased;
  }

  private async orRecordFailure(context: ExecutionContext, subject: string): Promise<boolean> {
    try {
      return await this.keys.erase(subject);
    } catch (error) {
      await this.recordFailure(context, subject);

      throw error;
    }
  }

  private async recordFailure(context: ExecutionContext, subject: string): Promise<void> {
    let record: AuditRecord | undefined;

    try {
      record = this.recordOf(context, subject, { outcome: 'failed', reason: UNEXPECTED_ERROR });
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
      ...result,
    });
  }
}
