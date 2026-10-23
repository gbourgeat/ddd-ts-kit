import { bigint, integer, jsonb, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { EVENT_STORE_TABLES } from '@ddd-ts-kit/kernel';
import { tableIn } from '../schema/table-in';

/**
 * The tables of the event store, to include in the schema files drizzle-kit reads so that the
 * migrations of the consuming project create them: the same columns as `eventStoreTablesSql` of
 * the kernel. One schema per bounded context that keeps an event store.
 */
export function eventStoreTables(schemaName?: string) {
  return {
    head: headTable(schemaName),
    events: eventsTable(schemaName),
    snapshots: snapshotsTable(schemaName),
    checkpoints: checkpointsTable(schemaName),
    subjectKeys: subjectKeysTable(schemaName),
  };
}

function headTable(schemaName: string | undefined) {
  return tableIn(schemaName)(EVENT_STORE_TABLES.head, {
    id: smallint('id').primaryKey(),
    position: bigint('position', { mode: 'number' }).notNull(),
  });
}

function eventsTable(schemaName: string | undefined) {
  return tableIn(schemaName)(
    EVENT_STORE_TABLES.events,
    {
      position: bigint('position', { mode: 'number' }).primaryKey(),
      stream: text('stream').notNull(),
      version: integer('version').notNull(),
      eventId: text('event_id').notNull(),
      type: text('type').notNull(),
      schemaVersion: integer('schema_version').notNull(),
      data: jsonb('data').notNull(),
      metadata: jsonb('metadata').notNull(),
      occurredAt: instant('occurred_at').notNull(),
      recordedAt: instant('recorded_at').notNull().defaultNow(),
    },
    (events) => [
      uniqueIndex(`${EVENT_STORE_TABLES.events}_stream_version_key`).on(events.stream, events.version),
      uniqueIndex(`${EVENT_STORE_TABLES.events}_event_id_key`).on(events.eventId),
    ],
  );
}

function snapshotsTable(schemaName: string | undefined) {
  return tableIn(schemaName)(EVENT_STORE_TABLES.snapshots, {
    stream: text('stream').primaryKey(),
    version: integer('version').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    data: jsonb('data').notNull(),
    takenAt: instant('taken_at').notNull().defaultNow(),
  });
}

function checkpointsTable(schemaName: string | undefined) {
  return tableIn(schemaName)(EVENT_STORE_TABLES.checkpoints, {
    subscriber: text('subscriber').primaryKey(),
    position: bigint('position', { mode: 'number' }).notNull(),
    updatedAt: instant('updated_at').notNull().defaultNow(),
  });
}

function subjectKeysTable(schemaName: string | undefined) {
  return tableIn(schemaName)(
    EVENT_STORE_TABLES.subjectKeys,
    {
      subject: text('subject').primaryKey(),
      keyId: text('key_id').notNull(),
      material: text('material').notNull(),
      createdAt: instant('created_at').notNull().defaultNow(),
    },
    (keys) => [uniqueIndex(`${EVENT_STORE_TABLES.subjectKeys}_key_id_key`).on(keys.keyId)],
  );
}

/** To the millisecond, as the kernel writes them. */
function instant(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date', precision: 3 });
}
