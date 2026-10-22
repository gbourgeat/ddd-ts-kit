import type { QueuedJob } from '@ddd-ts-kit/kernel';
import type { RedisJobRecord } from './redis-job-record';

/** What a record shows of its job: never the payload, the checkpoint or the actor. */
export function queuedJobOfRecord(record: RedisJobRecord): QueuedJob {
  return {
    id: record.id,
    name: record.name,
    queue: record.queue,
    status: record.status,
    attempts: record.attempts,
    enqueuedAt: new Date(record.enqueuedAt),
    runAt: new Date(record.runAt),
    ...(record.tenantId === undefined ? {} : { tenantId: record.tenantId }),
    ...(record.subject === undefined ? {} : { subject: record.subject }),
    ...(record.progress === undefined ? {} : { progress: record.progress }),
    ...(record.lastErrorCode === undefined ? {} : { lastErrorCode: record.lastErrorCode }),
    ...(record.finishedAt === undefined ? {} : { finishedAt: new Date(record.finishedAt) }),
  };
}
