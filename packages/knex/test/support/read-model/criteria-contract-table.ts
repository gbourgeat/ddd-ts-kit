import type { Knex } from 'knex';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { readModelColumns, type KnexReadModelOptions } from '../../../src/index.js';

export const READ_SIDE = 'read_side';

export const CONTRACT_TABLE: KnexReadModelOptions<CriteriaContractRow> = {
  schema: READ_SIDE,
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

/** What the migration of a read model would contain. The text columns that are ordered take the "C" collation. */
export async function createContractTable(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(READ_SIDE);

  await knex.schema.withSchema(READ_SIDE).createTable(CONTRACT_TABLE.table, (table) => {
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
