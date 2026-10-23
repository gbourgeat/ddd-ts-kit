import type { OutboxRecord, OutboxStatus } from '@ddd-ts-kit/events';
import type { PrismaOutboxRow } from './prisma-outbox-delegate';

export function toOutboxRecord(row: PrismaOutboxRow): OutboxRecord {
  return {
    event: {
      id: row.id,
      type: row.type,
      version: row.version,
      occurredAt: row.occurredAt,
      payload: row.payload,
      ...(row.traceparent === null ? {} : { traceparent: row.traceparent }),
      ...(row.correlationId === null ? {} : { correlationId: row.correlationId }),
    },
    status: statusOf(row.status),
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode }),
    ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt }),
  };
}

function statusOf(status: string): OutboxStatus {
  if (status === 'pending' || status === 'published' || status === 'dead') {
    return status;
  }

  throw new TypeError(`Unknown outbox status "${status}"`);
}
