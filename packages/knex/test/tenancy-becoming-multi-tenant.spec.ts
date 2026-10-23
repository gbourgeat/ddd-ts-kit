import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, InvalidTenantIdError } from '@ddd-ts-kit/kernel';
import { asTenant } from '@ddd-ts-kit/testing';
import {
  addOutboxTenantColumn,
  addTenantColumn,
  createKnexUnitOfWork,
  createOutboxTables,
  derivedTable,
  tenantColumn,
  tenantTable,
} from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const SCHEMA = 'clinic';
const VISITS = 'visits';
const BOOKED = 'booked';
const MESSAGING = 'moved';

interface Column {
  readonly table_schema: string;
  readonly table_name: string;
  readonly column_name: string;
  readonly is_nullable: string;
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await knex.schema.createSchemaIfNotExists(SCHEMA);
      await createVisits(knex, VISITS);
      await createVisits(knex, BOOKED, true);
      await createOutboxTables(knex, { schema: MESSAGING });
    },
    [`${SCHEMA}.${BOOKED}`, `${MESSAGING}.outbox`],
  );
});

afterAll(async () => {
  await database.close();
});

describe('a table that becomes tenant data', () => {
  beforeEach(async () => {
    await database.knex.schema.withSchema(SCHEMA).dropTableIfExists(VISITS);
    await createVisits(database.knex, VISITS);
  });

  it('gives the rows already there to the tenant named, then requires the column', async () => {
    await database.knex(VISITS).withSchema(SCHEMA).insert({ id: 'v-1', desk: 'north' });

    await addTenantColumn(database.knex, { schema: SCHEMA, table: VISITS, tenantOfExistingRows: 'acme' });

    expect(await database.knex(VISITS).withSchema(SCHEMA).select('id', 'tenant_id')).toEqual([
      { id: 'v-1', tenant_id: 'acme' },
    ]);

    expect(await nullable(VISITS)).toBe('NO');
  });

  it('refuses rows that no tenant names, and a tenant id outside the grammar, changing nothing', async () => {
    await database.knex(VISITS).withSchema(SCHEMA).insert({ id: 'v-1', desk: 'north' });

    const unnamed = database.knex.transaction((trx) => addTenantColumn(trx, { schema: SCHEMA, table: VISITS }));

    await expect(unnamed).rejects.toThrow('visits holds rows and no tenant');

    const outside = addTenantColumn(database.knex, { schema: SCHEMA, table: VISITS, tenantOfExistingRows: 'a,b' });

    await expect(outside).rejects.toBeInstanceOf(InvalidTenantIdError);
  });

  it('needs no tenant for an empty table, and leaves alone a table that has the column', async () => {
    await addTenantColumn(database.knex, { schema: SCHEMA, table: VISITS });
    await addTenantColumn(database.knex, { schema: SCHEMA, table: VISITS });
    await addTenantColumn(database.knex, { schema: SCHEMA, table: BOOKED });

    expect(await nullable(VISITS)).toBe('NO');
  });
});

describe('an outbox that becomes tenanted', () => {
  it('gives the events not published yet to the tenant named, and none to those already published', async () => {
    const outbox = () => database.knex('outbox').withSchema(MESSAGING);

    const recorded = (id: string, status: string) => ({
      id,
      type: 'clinic.visit.booked',
      version: 1,
      occurred_at: '2026-03-01T10:00:00.000Z',
      status,
      next_attempt_at: new Date('2026-03-01T10:00:00.000Z'),
    });

    await outbox().insert([recorded('e-1', 'pending'), recorded('e-2', 'published'), recorded('e-3', 'dead')]);

    await addOutboxTenantColumn(database.knex, { schema: MESSAGING, tenantOfUnpublished: 'acme' });

    expect(await outbox().select('id', 'tenant_id').orderBy('id')).toEqual([
      { id: 'e-1', tenant_id: 'acme' },
      { id: 'e-2', tenant_id: null },
      { id: 'e-3', tenant_id: 'acme' },
    ]);
  });
});

describe('the tables of the default schema', () => {
  const scope = new AsyncLocalStorageExecutionScope();
  const LEDGER = 'ledger_visits';

  beforeEach(async () => {
    await database.knex.schema.dropTableIfExists(LEDGER);
    await database.knex.schema.dropTableIfExists('outbox');
    await database.knex.schema.dropTableIfExists('processed_events');

    await database.knex.schema.createTable(LEDGER, (columns) => {
      columns.text('id').primary();
      columns.text('desk').notNullable();
    });

    await createOutboxTables(database.knex);
  });

  it('become tenant data and are read for the tenant alone, when no schema is named', async () => {
    await database.knex(LEDGER).insert({ id: 'v-1', desk: 'north' });
    await addTenantColumn(database.knex, { table: LEDGER, tenantOfExistingRows: 'acme' });
    await database.knex(LEDGER).insert({ id: 'v-2', desk: 'south', tenant_id: 'globex' });

    const seen = await asTenant(scope, 'acme', () =>
      tenantTable(createKnexUnitOfWork(database.knex), scope, { table: LEDGER }).select('id', 'tenant_id'),
    );

    expect(seen).toEqual([{ id: 'v-1', tenant_id: 'acme' }]);
  });

  it('give the events of the outbox not published yet to the tenant named, when no schema is named', async () => {
    await database.knex('outbox').insert({
      id: 'e-1',
      type: 'clinic.visit.booked',
      version: 1,
      occurred_at: '2026-03-01T10:00:00.000Z',
      status: 'pending',
      next_attempt_at: new Date('2026-03-01T10:00:00.000Z'),
    });

    await addOutboxTenantColumn(database.knex, { tenantOfUnpublished: 'acme' });

    expect(await database.knex('outbox').select('id', 'tenant_id')).toEqual([{ id: 'e-1', tenant_id: 'acme' }]);
  });
});

describe('a derived table', () => {
  const scope = new AsyncLocalStorageExecutionScope();
  const context = () => createKnexUnitOfWork(database.knex);

  it('groups the rows of the tenant, then pages the groups by their output columns', async () => {
    await database.truncate();

    await database
      .knex(BOOKED)
      .withSchema(SCHEMA)
      .insert([
        { id: 'b-1', desk: 'north', tenant_id: 'acme' },
        { id: 'b-2', desk: 'north', tenant_id: 'acme' },
        { id: 'b-3', desk: 'south', tenant_id: 'acme' },
        { id: 'b-4', desk: 'north', tenant_id: 'globex' },
      ]);

    const lines = await asTenant(scope, 'acme', async () => {
      const grouped = tenantTable(context(), scope, { schema: SCHEMA, table: BOOKED })
        .select('desk')
        .count({ visits: '*' })
        .groupBy('desk');

      return derivedTable<{ desk: string; visits: string }>(context(), grouped, 'occupancy').where('visits', '>', 1);
    });

    expect(lines).toEqual([{ desk: 'north', visits: '2' }]);
  });
});

function createVisits(knex: Knex, table: string, tenant = false): Promise<void> {
  return knex.schema.withSchema(SCHEMA).createTable(table, (columns) => {
    columns.text('id').primary();
    columns.text('desk').notNullable();

    if (tenant) {
      tenantColumn(columns);
    }
  });
}

async function nullable(table: string): Promise<string | undefined> {
  const column = await database
    .knex<Column>('information_schema.columns')
    .select('is_nullable')
    .where({ table_schema: SCHEMA, table_name: table, column_name: 'tenant_id' })
    .first();

  return column?.is_nullable;
}
