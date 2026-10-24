import type { QueuedJob } from '@ddd-ts-kit/kernel';
import { jobStatusOf } from './job-status-of';
import type { PrismaJobRow } from './prisma-job-delegate';
import { progressOf } from './progress-of';

/** What a row of the table shows of its job: never the payload, the checkpoint or the actor. */
export function jobOfRow(row: PrismaJobRow): QueuedJob {
  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    status: jobStatusOf(row.status),
    attempts: row.attempts,
    enqueuedAt: row.enqueuedAt,
    runAt: row.runAt,
    ...(row.tenantId === '' ? {} : { tenantId: row.tenantId }),
    ...(row.subject === null ? {} : { subject: row.subject }),
    ...progressOf(row.progress),
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode }),
    ...(row.finishedAt === null ? {} : { finishedAt: row.finishedAt }),
  };
}
