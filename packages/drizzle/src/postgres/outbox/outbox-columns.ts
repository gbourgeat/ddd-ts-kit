import { bigint, integer, jsonb, text } from 'drizzle-orm/pg-core';
import type { OutboxStatus } from '@ddd-ts-kit/events';
import { instant } from '../columns/instant.js';

/** The columns of every outbox, with or without the tenant. */
export function outboxColumns() {
  return {
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
  };
}
