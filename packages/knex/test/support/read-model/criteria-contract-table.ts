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

/** What a live row always holds, which the columns no longer say: a deleted row keeps its key and its stamp alone. */
const LIVE_ROWS =
  'deleted or (status is not null and title is not null and seats is not null and price is not null and starts_at is not null and remote is not null and tenant_id is not null)';

/**
 * What the migration of a read model would contain: every column of the row accepts NULL, which is
 * what a deleted row holds there, and the check constraint keeps the live rows whole. `remote` has a
 * default, which a deleted row does not take. The text columns that are ordered take the "C" collation. */
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
    table.text('status').nullable();
    table.text('title').nullable().unique({ indexName: 'criteria_contract_title_key' });
    table.integer('seats').nullable();
    table.specificType('price', 'numeric').nullable();
    table.datetime('starts_at', { useTz: true, precision: 3 }).nullable();
    table.datetime('cancelled_at', { useTz: true, precision: 3 }).nullable();
    table.specificType('room', 'text collate "C"').nullable();
    table.boolean('remote').nullable().defaultTo(false);
    table.text('tenant_id').nullable();
    readModelColumns(table);
    table.check(LIVE_ROWS, [], 'criteria_contract_live_rows');
    table.index(['tenant_id', 'starts_at', 'id'], 'criteria_contract_tenant_starts_idx');
  });
}
