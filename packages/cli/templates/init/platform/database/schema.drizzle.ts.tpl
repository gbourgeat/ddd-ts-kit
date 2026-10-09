import { outboxTable, processedEventsTable } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging');
export const processedEvents = processedEventsTable('messaging');

// ddd-ts-kit:schemas
// /ddd-ts-kit:schemas
