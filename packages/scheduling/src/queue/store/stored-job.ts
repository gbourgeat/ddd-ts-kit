import type { EnqueuedBy, JobProgress, QueuedJobStatus } from '@ddd-ts-kit/kernel';

/** A job as the in-memory store keeps it. */
export interface StoredJob {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  readonly payload: unknown;
  readonly enqueuedBy: EnqueuedBy;
  readonly enqueuedAt: Date;
  readonly idempotencyKey: string | undefined;
  readonly subject: string | undefined;
  readonly sequence: number;
  status: QueuedJobStatus;
  attempts: number;
  runAt: Date;
  leaseUntil: Date | undefined;
  progress: JobProgress | undefined;
  checkpoint: unknown;
  lastErrorCode: string | undefined;
  finishedAt: Date | undefined;
}
