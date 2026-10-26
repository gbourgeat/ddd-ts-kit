import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import { EVENT_STORE_TABLES, type EventStoreTablesOptions } from '@ddd-ts-kit/kernel';
import { INSTANT } from '../columns/instant';
import { RIGHT_NOW } from '../columns/right-now';

type Columns = Record<string, EntitySchemaColumnOptions>;

interface Table {
  readonly name: string;
  readonly table: keyof typeof EVENT_STORE_TABLES;
  readonly columns: Columns;
  readonly uniques?: readonly string[][];
}

/**
 * The tables of the event store as `EntitySchema`s, PostgreSQL only: add them to the `entities`
 * of the data source and `typeorm migration:generate` creates them in a migration of the
 * consuming project, with the columns of `eventStoreTablesSql` of the kernel. The stores never
 * use them as entities: they run their own statements on these tables.
 */
export function eventStoreEntities(options: EventStoreTablesOptions = {}): EntitySchema[] {
  return [HEAD, EVENTS, SNAPSHOTS, CHECKPOINTS, SUBJECT_KEYS].map((table) => entityOf(table, options));
}

function entityOf({ name, table, columns, uniques = [] }: Table, { schema }: EventStoreTablesOptions): EntitySchema {
  return new EntitySchema({
    name: schema === undefined ? name : `${name}_${schema}`,
    tableName: EVENT_STORE_TABLES[table],
    ...(schema === undefined ? {} : { schema }),
    columns,
    uniques: uniques.map((columnsOf) => ({ columns: columnsOf })),
  });
}

const HEAD: Table = {
  name: 'StoredEventsHead',
  table: 'head',
  columns: { id: { type: 'smallint', primary: true }, position: { type: 'bigint' } },
};

const EVENTS: Table = {
  name: 'StoredEvent',
  table: 'events',
  columns: {
    position: { type: 'bigint', primary: true },
    stream: { type: 'text' },
    version: { type: 'int' },
    eventId: { name: 'event_id', type: 'text', unique: true },
    type: { type: 'text' },
    schemaVersion: { name: 'schema_version', type: 'int' },
    data: { type: 'jsonb' },
    metadata: { type: 'jsonb' },
    occurredAt: instant('occurred_at'),
    tenantId: { name: 'tenant_id', type: 'text', nullable: true },
    recordedAt: instant('recorded_at', true),
  },
  uniques: [['stream', 'version']],
};

const SNAPSHOTS: Table = {
  name: 'StreamSnapshot',
  table: 'snapshots',
  columns: {
    stream: { type: 'text', primary: true },
    version: { type: 'int' },
    schemaVersion: { name: 'schema_version', type: 'int' },
    data: { type: 'jsonb' },
    takenAt: instant('taken_at', true),
  },
};

const CHECKPOINTS: Table = {
  name: 'SubscriptionCheckpoint',
  table: 'checkpoints',
  columns: {
    subscriber: { type: 'text', primary: true },
    position: { type: 'bigint' },
    updatedAt: instant('updated_at', true),
  },
};

const SUBJECT_KEYS: Table = {
  name: 'SubjectKey',
  table: 'subjectKeys',
  columns: {
    subject: { type: 'text', primary: true },
    keyId: { name: 'key_id', type: 'text', unique: true },
    material: { type: 'text' },
    createdAt: instant('created_at', true),
  },
};

function instant(name: string, defaulted = false): EntitySchemaColumnOptions {
  return { ...INSTANT.postgres, name, ...(defaulted ? { default: RIGHT_NOW.postgres } : {}) };
}
