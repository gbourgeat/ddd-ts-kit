import type { JobProgress, QueuedJobStatus } from '@ddd-ts-kit/kernel';

/** A job as the Redis store keeps it: instants in epoch milliseconds, JSON values as texts. */
export interface RedisJobRecord {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  readonly payload: string;
  /** A JSON text: an empty list would come back from the scripts as an empty object. */
  readonly enqueuedBy: string;
  /** The idempotency field, name and key together. */
  readonly key?: string;
  readonly seq: number;
  readonly status: QueuedJobStatus;
  readonly attempts: number;
  readonly runAt: number;
  readonly leaseUntil?: number;
  readonly progress?: JobProgress;
  readonly checkpoint?: string;
  readonly lastErrorCode?: string;
  readonly enqueuedAt: number;
  readonly finishedAt?: number;
}
