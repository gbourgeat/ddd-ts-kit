import type { QueuedJobStatus } from '@ddd-ts-kit/kernel';

/** Where a clearance stands: the status of its job, the attempts it took and the appointments handled out of all. */
export interface GetClearanceResult {
  readonly clearanceId: string;
  readonly status: QueuedJobStatus;
  readonly attempts: number;
  readonly done: number;
  /** Absent until the first attempt started. */
  readonly total?: number;
  /** The code of the last failure of an attempt, when one failed. */
  readonly lastErrorCode?: string;
}
