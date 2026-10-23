import type { Knex } from 'knex';
import { assertTenantId } from '@ddd-ts-kit/kernel';
import { builderIn } from './builder-in';
import type { OutboxTablesOptions } from './outbox-tables-options';
import { INDEXABLE_LENGTH } from '../columns/indexable-length';
import { OUTBOX_TABLE } from './table-names';

export interface AddOutboxTenantColumnOptions extends OutboxTablesOptions {
  /**
   * The tenant of the events not published yet (pending, or dead and waiting for a replay): the
   * one the database served. Left out, they keep no tenant, and their consumers run in none,
   * which a tenant-scoped repository refuses: drain the outbox before migrating instead.
   */
  readonly tenantOfUnpublished?: string;
}

/**
 * Adds `tenant_id` to an outbox created without it: the migration of a project that becomes
 * multi-tenant (`export const up = (knex) => addOutboxTenantColumn(knex, { schema: 'messaging', tenantOfUnpublished: 'acme' })`).
 * Nullable: the events already published belong to no tenant.
 */
export async function addOutboxTenantColumn(knex: Knex, options: AddOutboxTenantColumnOptions = {}): Promise<void> {
  const outbox = options.outboxTable ?? OUTBOX_TABLE;
  const tenantId = options.tenantOfUnpublished === undefined ? undefined : assertTenantId(options.tenantOfUnpublished);

  await builderIn(knex, options.schema).alterTable(outbox, (table) => {
    table.string('tenant_id', INDEXABLE_LENGTH);
  });

  if (tenantId === undefined) {
    return;
  }

  const rows = options.schema === undefined ? knex(outbox) : knex(outbox).withSchema(options.schema);

  await rows.whereNot({ status: 'published' }).update({ tenant_id: tenantId });
}
