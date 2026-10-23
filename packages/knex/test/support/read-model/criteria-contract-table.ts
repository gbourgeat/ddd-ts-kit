import type { Knex } from 'knex';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { readModelColumns, type KnexReadModelOptions } from '../../../src';

export const READ_SIDE = 'read_side';

/** The table of the contract dataset in the default schema of the connection. */
export const CONTRACT_TABLE_IN_DEFAULT_SCHEMA: KnexReadModelOptions<CriteriaContractRow> = {
  table: 'criteria_contract',
  columns: {
    id: 'id',
    status: 'status',
    title: 'title',
    seats: 'seats',
    price: 'price',
    startsAt: 'starts_at',
    cancelledAt: 'cancelled_at',
    room: 'room',
    remote: 'remote',
    tenantId: 'tenant_id',
  },
};

export const CONTRACT_TABLE: KnexReadModelOptions<CriteriaContractRow> = {
  ...CONTRACT_TABLE_IN_DEFAULT_SCHEMA,
  schema: READ_SIDE,
};

/** What the migration of a read model would contain. The text columns that are ordered take the "C" collation. */
export function createContractTable(knex: Knex): Promise<void> {
  return createContractTableIn(knex, READ_SIDE);
}

/** The same table in the default schema of the connection. */
export function createContractTableInDefaultSchema(knex: Knex): Promise<void> {
  return createContractTableIn(knex, undefined);
}

async function createContractTableIn(knex: Knex, schema: string | undefined): Promise<void> {
  if (schema !== undefined) {
    await knex.schema.createSchemaIfNotExists(schema);
  }

  const tables = schema === undefined ? knex.schema : knex.schema.withSchema(schema);

  await tables.createTable(CONTRACT_TABLE.table, (table) => {
    table.text('id').primary();
    table.text('status').notNullable();
    table.text('title').notNullable();
    table.integer('seats').notNullable();
    table.specificType('price', 'numeric').notNullable();
    table.datetime('starts_at', { useTz: true, precision: 3 }).notNullable();
    table.datetime('cancelled_at', { useTz: true, precision: 3 }).nullable();
    table.specificType('room', 'text collate "C"').nullable();
    table.boolean('remote').notNullable();
    table.text('tenant_id').notNullable();
    readModelColumns(table);
    table.index(['tenant_id', 'starts_at', 'id'], 'criteria_contract_tenant_starts_idx');
  });
}
