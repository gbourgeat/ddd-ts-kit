import { sql } from 'drizzle-orm';
import { bigint, index, integer, jsonb, text } from 'drizzle-orm/pg-core';
import type { OutboxStatus } from '@ddd-ts-kit/events';
import { instant } from '../columns/instant.js';
import { tableIn } from '../schema/table-in.js';

export type OutboxTable = ReturnType<typeof outboxTable>;

/**
 * The outbox table, to include in the schema files drizzle-kit reads so that it is created by
 * the migrations of the consuming project. Without a schema name it lives in `public`.
 */
export function outboxTable(schemaName?: string) {
  return tableIn(schemaName)(
    'outbox',
    {
      id: text('id').primaryKey(),
      /** Insertion order, the tie-breaker of the claim. */
      sequence: bigint('sequence', { mode: 'number' }).generatedAlwaysAsIdentity(),
      type: text('type').notNull(),
      version: integer('version').notNull(),
      // Text, not timestamptz: the envelope must come back exactly as published, offset included.
      occurredAt: text('occurred_at').notNull(),
      // Nullable because JSON `null` is a legal payload and is stored as SQL NULL.
      payload: jsonb('payload'),
      traceparent: text('traceparent'),
      correlationId: text('correlation_id'),
      status: text('status').$type<OutboxStatus>().notNull().default('pending'),
      attempts: integer('attempts').notNull().default(0),
      nextAttemptAt: instant('next_attempt_at').notNull(),
      lastErrorCode: text('last_error_code'),
      publishedAt: instant('published_at'),
      createdAt: instant('created_at').notNull().defaultNow(),
    },
    (table) => [
      // Partial: the relay only ever scans what is pending, and published rows dominate.
      index('outbox_pending_idx')
        .on(table.nextAttemptAt, table.sequence)
        .where(sql`${table.status} = 'pending'`),
    ],
  );
}
