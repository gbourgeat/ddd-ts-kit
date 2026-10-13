import type { JobProgress } from '@ddd-ts-kit/kernel';

/** What a run stores while it goes on: either or both. */
export interface JobUpdate {
  readonly progress?: JobProgress;
  readonly checkpoint?: unknown;
}
