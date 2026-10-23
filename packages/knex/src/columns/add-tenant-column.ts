import type { Knex } from 'knex';
import { assertTenantId } from '@ddd-ts-kit/kernel';
import { builderIn } from '../outbox/builder-in';
import { TENANT_COLUMN } from '../tenancy/where-tenant';
import type { AddTenantColumnOptions } from './add-tenant-column-options';
import { INDEXABLE_LENGTH } from './indexable-length';

/**
 * Adds `tenant_id` to a table of tenant data created without it: the migration of a project that
 * becomes multi-tenant. The rows already there are given to `tenantOfExistingRows`, then the
 * column is required and indexed as `tenantColumn` would have made it. A table that already has
 * the column (created by a schema that has it) is left as it is, so that the migration also runs
 * on a database the first migration built from the current schema.
 */
export async function addTenantColumn(knex: Knex, options: AddTenantColumnOptions): Promise<void> {
  if (await builderIn(knex, options.schema).hasColumn(options.table, TENANT_COLUMN)) {
    return;
  }

  await builderIn(knex, options.schema).alterTable(options.table, (table) => {
    table.string(TENANT_COLUMN, INDEXABLE_LENGTH);
  });

  await giveExistingRows(knex, options);

  await builderIn(knex, options.schema).alterTable(options.table, (table) => {
    table.dropNullable(TENANT_COLUMN);
    table.index([TENANT_COLUMN, options.key ?? 'id'], `${options.table}_tenant_idx`);
  });
}

/** The rows already there go to the tenant named; rows and no tenant are refused, before the column is required. */
async function giveExistingRows(knex: Knex, options: AddTenantColumnOptions): Promise<void> {
  const rows = () =>
    options.schema === undefined ? knex(options.table) : knex(options.table).withSchema(options.schema);

  if (options.tenantOfExistingRows !== undefined) {
    await rows().update({ [TENANT_COLUMN]: assertTenantId(options.tenantOfExistingRows) });

    return;
  }

  if ((await rows().first()) !== undefined) {
    throw new Error(
      `${options.table} holds rows and no tenant: name the tenant they belong to (tenantOfExistingRows).`,
    );
  }
}
