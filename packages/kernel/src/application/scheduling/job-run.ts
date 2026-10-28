import type { JobOutcome } from './job-outcome';

/** One occurrence and what became of it, as data. Never the message of an error: it quotes data. */
export interface JobRun {
  readonly job: string;
  readonly outcome: JobOutcome;
  readonly scheduledAt: Date;
  /** Present when the job ran. */
  readonly startedAt?: Date;
  readonly durationMs?: number;
  /**
   * How many tenants a succeeded run of a per-tenant job ran for; 0 when the directory had none,
   * and the job was never called. Absent for a global job.
   */
  readonly tenants?: number;
  /** The `code` of what the job threw, or `UNEXPECTED_ERROR`. */
  readonly errorCode?: string;
}
