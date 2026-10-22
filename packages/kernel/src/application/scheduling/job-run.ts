import type { JobOutcome } from './job-outcome';

/** One occurrence and what became of it, as data. Never the message of an error: it quotes data. */
export interface JobRun {
  readonly job: string;
  readonly outcome: JobOutcome;
  readonly scheduledAt: Date;
  /** Present when the job ran. */
  readonly startedAt?: Date;
  readonly durationMs?: number;
  /** The `code` of what the job threw, or `UNEXPECTED_ERROR`. */
  readonly errorCode?: string;
}
