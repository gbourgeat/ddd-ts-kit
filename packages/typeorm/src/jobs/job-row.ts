import type { EnqueuedBy, JobProgress, QueuedJobStatus } from '@ddd-ts-kit/kernel';
import type { JsonDocument } from '../columns/json-document';

/** The table of the background jobs as TypeORM returns it. */
export interface JobRow {
  id: string;
  /** Insertion order, the tie-breaker of the claim. A bigint, which drivers return as a string. */
  sequence: string | number;
  name: string;
  queue: string;
  /** JSON; SQL NULL for a `null` payload. */
  payload: JsonDocument | null;
  enqueuedBy: EnqueuedBy;
  idempotencyKey: string | null;
  /** The empty text for a job enqueued outside any tenant. */
  tenantId: string;
  subject: string | null;
  status: QueuedJobStatus;
  attempts: number;
  runAt: Date;
  leaseUntil: Date | null;
  progress: JobProgress | null;
  checkpoint: JsonDocument | null;
  lastErrorCode: string | null;
  enqueuedAt: Date;
  finishedAt: Date | null;
}
