import type { QueuedJob } from '@ddd-ts-kit/kernel';
import type { JobRow } from './job-row.js';

/** What a row of the table shows of its job: never the payload, the checkpoint or who enqueued it. */
export function jobOfRow(row: JobRow): QueuedJob {
  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    status: row.status,
    attempts: row.attempts,
    enqueuedAt: new Date(row.enqueued_at),
    runAt: new Date(row.run_at),
    ...(row.progress === null ? {} : { progress: row.progress }),
    ...(row.last_error_code === null ? {} : { lastErrorCode: row.last_error_code }),
    ...(row.finished_at === null ? {} : { finishedAt: new Date(row.finished_at) }),
  };
}
