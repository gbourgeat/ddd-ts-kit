import type { QueuedJob } from '@ddd-ts-kit/kernel';
import type { StoredJob } from './stored-job.js';

/** What a stored job shows of itself: never its payload, its checkpoint or its actor. */
export function queuedJobOf(job: StoredJob): QueuedJob {
  return {
    id: job.id,
    name: job.name,
    queue: job.queue,
    status: job.status,
    attempts: job.attempts,
    enqueuedAt: job.enqueuedAt,
    runAt: job.runAt,
    ...(job.enqueuedBy.tenantId === undefined ? {} : { tenantId: job.enqueuedBy.tenantId }),
    ...(job.subject === undefined ? {} : { subject: job.subject }),
    ...(job.progress === undefined ? {} : { progress: job.progress }),
    ...(job.lastErrorCode === undefined ? {} : { lastErrorCode: job.lastErrorCode }),
    ...(job.finishedAt === undefined ? {} : { finishedAt: job.finishedAt }),
  };
}
