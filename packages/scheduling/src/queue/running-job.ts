import type { JobLease } from './store/job-lease';
import type { ClaimedJob } from './store/claimed-job';
import type { RegisteredBackgroundJob } from './registered-background-job';

/** One attempt in progress: what it runs, what it holds, and how to stop it. */
export interface RunningJob {
  readonly job: ClaimedJob;
  readonly registered: RegisteredBackgroundJob;
  readonly lease: JobLease;
  readonly controller: AbortController;
  readonly startedAt: Date;
  /** Cancels the next heartbeat. */
  stopBeating: () => void;
}
