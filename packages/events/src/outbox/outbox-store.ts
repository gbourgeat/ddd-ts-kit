import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord } from './outbox-record';
import type { OutboxStats } from './outbox-stats';
import type { PersonalEvent } from './personal-event';

/**
 * Where events wait between the commit of the command and their publication.
 *
 * A claim is a lease, not a lock held by the caller: `claimBatch` hands out due records and
 * pushes their `nextAttemptAt` forward by the lease of the store, so a relay that dies
 * mid-flight simply lets the lease expire and the records are claimed again. This keeps the
 * port implementable by SQL (`FOR UPDATE SKIP LOCKED` inside the claim), by a document store
 * with a conditional update, or by a queue with a visibility timeout.
 */
export abstract class OutboxStore {
  static readonly tokenKey = 'events.OutboxStore';

  /** Must join the transaction of the command when the store is transactional. */
  abstract append(events: readonly IntegrationEvent[]): Promise<void>;

  /**
   * Claims up to `limit` pending records due at `now`, oldest first, and counts the attempt.
   * Two concurrent calls never return the same record.
   */
  abstract claimBatch(limit: number, now: Date): Promise<OutboxRecord[]>;

  abstract markPublished(ids: readonly string[], at: Date): Promise<void>;

  /** Schedules the retry at `nextAttemptAt`, or declares the record dead when it is `null`. */
  abstract markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void>;

  /** Puts dead records back in the queue with a fresh attempt budget. Returns how many. */
  abstract retryDead(ids: readonly string[], now: Date): Promise<number>;

  /** Housekeeping: drops the records published before `before`. Returns how many. */
  abstract purgePublished(before: Date): Promise<number>;

  /**
   * The right to erasure: in every record of these events that names `subject`, whatever its
   * status, the fields its declaration lists are erased with `erasedPayloadOf`. A record waiting for
   * the relay stays due, and goes out with what is left of it. Answers how many records changed, none
   * the second time. Reads every record of these events: the purge of what was published bounds them.
   */
  abstract erasePersonalFields(subject: string, events: readonly PersonalEvent[]): Promise<number>;

  abstract stats(): Promise<OutboxStats>;
}
