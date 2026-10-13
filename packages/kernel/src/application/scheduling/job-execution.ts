/** What a run is told about itself. */
export interface JobExecution {
  /** The instant the run was due. For `runNow`, the instant it was asked. */
  readonly scheduledAt: Date;
  /** The instant the run really started: later than `scheduledAt` by the jitter, a queue or a catch-up. */
  readonly startedAt: Date;
  /** 1 for a scheduler that never retries, as the in-process one; a scheduler that redelivers counts. */
  readonly attempt: number;
  /** Aborted when the run exceeds its timeout or the scheduler stops: a long job checks it. */
  readonly signal: AbortSignal;
  /** The tenant of this run, for a job declared `tenancy: 'per-tenant'`. */
  readonly tenantId?: string;
}
