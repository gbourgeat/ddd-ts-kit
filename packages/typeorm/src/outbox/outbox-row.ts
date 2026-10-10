import type { OutboxStatus } from '@ddd-ts-kit/events';

export interface OutboxRow {
  id: string;
  /** Insertion order, the tie-breaker of the claim. A bigint, which drivers return as a string. */
  sequence: string | number;
  type: string;
  version: number;
  occurredAt: string;
  payload: unknown;
  traceparent: string | null;
  correlationId: string | null;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastErrorCode: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}
