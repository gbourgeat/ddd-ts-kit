import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keepTheNetworkOfEveryRow } from '@/platform/database/keep-the-network-of-every-row';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { MESSAGING } from '@/platform/database/schema';

/** The schemas of the bounded contexts: every table in them holds the data of one network. */
const CONTEXT_SCHEMAS = ['identity', 'scheduling', 'notification', 'analytics'];

/** The event store of the attendance records and the history it feeds, which keep no network yet (ADR-0004). */
const WITHOUT_NETWORK = [
  'scheduling.attendance_history',
  'scheduling.stored_events',
  'scheduling.stored_events_head',
  'scheduling.stream_snapshots',
  'scheduling.subject_keys',
  'scheduling.subscription_checkpoints',
];

interface Column {
  readonly table_schema: string;
  readonly table_name: string;
  readonly is_nullable?: string;
}

let database: TestDatabase;
let knex: Knex;

beforeAll(async () => {
  database = await openTestDatabase();
  knex = database.persistence.database.executor();
});

afterAll(async () => {
  await database.close();
});

describe('The network of every row (ADR-0003, ADR-0004)', () => {
  it('is a required column of every table of the contexts, so the migration has nothing to add to a new database', async () => {
    await keepTheNetworkOfEveryRow(knex);

    const tables = await knex<Column>('information_schema.tables')
      .select('table_schema', 'table_name')
      .whereIn('table_schema', CONTEXT_SCHEMAS)
      .where('table_type', 'BASE TABLE');

    const networks = await knex<Column>('information_schema.columns')
      .select('table_schema', 'table_name', 'is_nullable')
      .whereIn('table_schema', CONTEXT_SCHEMAS)
      .where('column_name', 'tenant_id');

    const ofNetworks = tables.map(nameOf).filter((name) => !WITHOUT_NETWORK.includes(name));

    expect(tables.length).toBeGreaterThan(0);
    expect(networks.map(nameOf).sort()).toEqual(ofNetworks.sort());
    expect(networks.every((column) => column.is_nullable === 'NO')).toBe(true);
  });

  it('is given to the rows of a database created before, the network it served named', async () => {
    await knex.schema.withSchema(IDENTITY_SCHEMA).alterTable('persons', (table) => {
      table.dropColumn('tenant_id');
    });

    await knex('persons').withSchema(IDENTITY_SCHEMA).insert(personRow());
    await keepTheNetworkOfEveryRow(knex, 'north');

    expect(await knex('persons').withSchema(IDENTITY_SCHEMA).select('id', 'tenant_id')).toEqual([
      { id: 'person-before', tenant_id: 'north' },
    ]);
  });

  it('is kept by the instances of the process managers, and given to those of a database created before', async () => {
    const required = await knex<Column>('information_schema.columns')
      .select('is_nullable')
      .where('table_schema', MESSAGING)
      .where('table_name', 'process_instances')
      .where('column_name', 'tenant_id');

    expect(required).toEqual([{ is_nullable: 'NO' }]);

    await knex.schema.withSchema(MESSAGING).alterTable('process_instances', (table) => {
      table.dropColumn('tenant_id');
    });

    await knex('process_instances').withSchema(MESSAGING).insert(processRow());
    await keepTheNetworkOfEveryRow(knex, 'north');

    expect(await knex('process_instances').withSchema(MESSAGING).select('id', 'tenant_id')).toEqual([
      { id: 'appointment-before', tenant_id: 'north' },
    ]);
  });

  it('is given to the background jobs not finished yet, so that their next attempt runs in that network', async () => {
    await knex('background_jobs')
      .withSchema(MESSAGING)
      .insert([jobRow('waiting-before', 'waiting'), jobRow('done-before', 'succeeded')]);

    await keepTheNetworkOfEveryRow(knex, 'north');

    const jobs = await knex('background_jobs')
      .withSchema(MESSAGING)
      .select('id', 'tenant_id', 'enqueued_by')
      .whereIn('id', ['waiting-before', 'done-before'])
      .orderBy('id');

    expect(jobs.map(({ id, tenant_id, enqueued_by }) => ({ id, tenant_id, tenantId: enqueued_by.tenantId }))).toEqual([
      { id: 'done-before', tenant_id: '', tenantId: undefined },
      { id: 'waiting-before', tenant_id: 'north', tenantId: 'north' },
    ]);
  });
});

function nameOf(column: Column): string {
  return column.table_schema + '.' + column.table_name;
}

function personRow(): Readonly<Record<string, unknown>> {
  const at = new Date('2026-01-01T00:00:00.000Z');

  return {
    id: 'person-before',
    registered_at: at,
    display_name: 'Ada',
    email: 'ada@example.test',
    version: 1,
    created_at: at,
    created_by: 'system',
    updated_at: at,
    updated_by: 'system',
  };
}

function processRow(): Readonly<Record<string, unknown>> {
  return {
    name: 'scheduling.confirmation-deadline',
    id: 'appointment-before',
    state: JSON.stringify({ appointmentId: 'appointment-before' }),
    version: 1,
    ended: false,
    timeouts: JSON.stringify({}),
  };
}

function jobRow(id: string, status: string): Readonly<Record<string, unknown>> {
  const at = new Date('2026-01-01T00:00:00.000Z');

  return {
    id,
    name: 'scheduling.clear-calendar',
    queue: 'default',
    enqueued_by: JSON.stringify({ correlationId: 'correlation-before', actor: { id: 'ada', type: 'user' } }),
    status,
    run_at: at,
    enqueued_at: at,
  };
}
