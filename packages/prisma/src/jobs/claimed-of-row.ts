import type { ClaimedJob } from '@ddd-ts-kit/scheduling';
import { enqueuedByOf } from './enqueued-by-of';
import type { PrismaJobRow } from './prisma-job-delegate';

/** A row as the worker receives it, read after the claim counted the attempt. */
export function claimedOfRow(row: PrismaJobRow): ClaimedJob {
  const checkpoint: unknown = row.checkpoint === null ? null : JSON.parse(row.checkpoint);

  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    payload: row.payload,
    enqueuedBy: enqueuedByOf(row.enqueuedBy),
    enqueuedAt: row.enqueuedAt,
    attempt: row.attempts,
    ...(checkpoint === null ? {} : { checkpoint }),
  };
}
