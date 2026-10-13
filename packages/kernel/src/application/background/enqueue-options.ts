import type { DurationText } from '../scheduling/duration-text.js';

export interface EnqueueOptions {
  /** Runs no earlier than this long after the commit. Default: as soon as a worker is free. */
  readonly delay?: number | DurationText;
  /** Runs no earlier than this instant. Not with `delay`. */
  readonly runAt?: Date;
  /**
   * A second job of the same name and key, enqueued for the same tenant, is not added while the
   * first is kept: `enqueue` answers the id of the first. Two tenants never share a key. Derive
   * it from the work (`practice-42:2026-10`), never from a random value.
   */
  readonly idempotencyKey?: string;
  /**
   * The id of what the job works on (a calendar, an import), kept with the job and answered by
   * `find`, which never shows the payload: a query reading a job through the element it was
   * asked about checks that the job is about that element.
   */
  readonly subject?: string;
}
