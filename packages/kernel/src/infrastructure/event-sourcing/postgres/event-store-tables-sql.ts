import type { EventStoreTablesOptions } from './event-store-tables-options.js';
import { qualifiedTable } from './qualified-table.js';

/**
 * The statements that create the tables of an event store on PostgreSQL, for a migration of the
 * project: the events, the head of the store (the position the next append starts after), the
 * snapshots, the checkpoints of the subscriptions and the keys of the data subjects. Each one
 * can run again.
 */
export function eventStoreTablesSql(options: EventStoreTablesOptions = {}): readonly string[] {
  const { schema } = options;
  const table = (name: Parameters<typeof qualifiedTable>[1]): string => qualifiedTable(schema, name);

  return [
    ...(schema === undefined ? [] : [`create schema if not exists "${schema.replaceAll('"', '""')}"`]),
    `create table if not exists ${table('head')} (id smallint primary key, position bigint not null)`,
    `create table if not exists ${table('events')} (
  position bigint primary key,
  stream text not null,
  version integer not null,
  event_id text not null unique,
  type text not null,
  schema_version integer not null,
  data jsonb not null,
  metadata jsonb not null,
  occurred_at timestamptz(3) not null,
  recorded_at timestamptz(3) not null default now(),
  unique (stream, version)
)`,
    `create table if not exists ${table('snapshots')} (stream text primary key, version integer not null, schema_version integer not null, data jsonb not null, taken_at timestamptz(3) not null default now())`,
    `create table if not exists ${table('checkpoints')} (subscriber text primary key, position bigint not null, updated_at timestamptz(3) not null default now())`,
    `create table if not exists ${table('subjectKeys')} (subject text primary key, key_id text not null unique, material text not null, created_at timestamptz(3) not null default now())`,
  ];
}
