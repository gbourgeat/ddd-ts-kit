import type { DurationText } from '../scheduling/duration-text.js';

export interface EnqueueOptions {
  /** Runs no earlier than this long after the commit. Default: as soon as a worker is free. */
  readonly delay?: number | DurationText;
  /** Runs no earlier than this instant. Not with `delay`. */
  readonly runAt?: Date;
  /**
   * A second job of the same name and key is not added while the first is kept: `enqueue`
   * answers the id of the first. Derive it from the work (`practice-42:2026-10`), never from a
   * random value.
   */
  readonly idempotencyKey?: string;
}
