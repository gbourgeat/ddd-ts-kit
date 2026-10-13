/** What `enqueue` answers. */
export interface EnqueuedJob {
  readonly id: string;
  /** True when a job of the same name and idempotency key was already there: its id is answered and nothing is added. */
  readonly duplicate: boolean;
}
