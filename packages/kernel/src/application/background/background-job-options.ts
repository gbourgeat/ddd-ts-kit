import type { DurationText } from '../scheduling/duration-text';
import type { JobBackoff } from './job-backoff';

export interface BackgroundJobOptions {
  /** Attempts before the job is declared dead. Default 5. */
  readonly maxAttempts?: number;
  readonly backoff?: JobBackoff;
  /** Aborts a run that lasts longer, through its signal, and counts it as failed. Default: no limit. */
  readonly timeout?: number | DurationText;
  /**
   * How long a claimed job stays invisible to other workers without news of its own: the worker
   * extends it while the run goes on, so only a worker that died lets it expire, and the job is
   * then claimed again. Default 30 seconds.
   */
  readonly lease?: number | DurationText;
}
