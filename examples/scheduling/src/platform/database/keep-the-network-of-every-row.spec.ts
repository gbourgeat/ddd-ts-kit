import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keepTheNetworkOfEveryRow } from '@/platform/database/keep-the-network-of-every-row';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';

/** The schemas of the bounded contexts: every table in them holds the data of one network. */
const CONTEXT_SCHEMAS = ['identity', 'scheduling', 'notification', 'analytics'];

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

describe('The network of every row (ADR-0003)', () => {
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

    expect(tables.length).toBeGreaterThan(0);
    expect(networks.map(nameOf).sort()).toEqual(tables.map(nameOf).sort());
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
