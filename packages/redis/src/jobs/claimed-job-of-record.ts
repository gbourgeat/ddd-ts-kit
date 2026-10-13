import type { ClaimedJob } from '@ddd-ts-kit/scheduling';
import { parseEnqueuedBy } from './parse-enqueued-by.js';
import type { RedisJobRecord } from './redis-job-record.js';

/** A record as the worker receives it. */
export function claimedJobOfRecord(record: RedisJobRecord): ClaimedJob {
  const payload: unknown = JSON.parse(record.payload);

  return {
    id: record.id,
    name: record.name,
    queue: record.queue,
    payload,
    enqueuedBy: parseEnqueuedBy(record.enqueuedBy),
    enqueuedAt: new Date(record.enqueuedAt),
    attempt: record.attempts,
    ...checkpointOf(record),
  };
}

function checkpointOf(record: RedisJobRecord): { checkpoint?: unknown } {
  if (record.checkpoint === undefined) {
    return {};
  }

  const checkpoint: unknown = JSON.parse(record.checkpoint);

  return { checkpoint };
}
