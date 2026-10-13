import type { EnqueuedBy, JobProgress, QueuedJobStatus } from '@ddd-ts-kit/kernel';

/** The table of the background jobs as knex returns it. */
export interface JobRow {
  id: string;
  sequence: number | string;
  name: string;
  queue: string;
  payload: unknown;
  enqueued_by: EnqueuedBy;
  idempotency_key: string | null;
  /** The empty text for a job enqueued outside any tenant. */
  tenant_id: string;
  subject: string | null;
  status: QueuedJobStatus;
  attempts: number;
  run_at: Date;
  lease_until: Date | null;
  progress: JobProgress | null;
  checkpoint: unknown;
  last_error_code: string | null;
  enqueued_at: Date;
  finished_at: Date | null;
}
