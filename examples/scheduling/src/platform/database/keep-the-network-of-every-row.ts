import type { Knex } from 'knex';
import {
  JOB_TABLE,
  OUTBOX_TABLE,
  PROCESS_TABLE,
  addOutboxTenantColumn,
  addTenantColumn,
  type AddTenantColumnOptions,
} from '@ddd-ts-kit/knex';
import { MESSAGING } from '@/platform/database/schema';
import { ANALYTICS_SCHEMA } from '@/contexts/analytics/infrastructure/persistence/analytics.schema';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

/** The tables of the contexts as they stood when the application became multi-tenant (ADR-0003). */
const TABLES_OF_ONE_CUSTOMER: readonly AddTenantColumnOptions[] = [
  { schema: IDENTITY_SCHEMA, table: 'persons' },
  { schema: IDENTITY_SCHEMA, table: 'practices' },
  { schema: IDENTITY_SCHEMA, table: 'delegations' },
  { schema: SCHEDULING_SCHEMA, table: 'calendars' },
  { schema: SCHEDULING_SCHEMA, table: 'appointments' },
  { schema: SCHEDULING_SCHEMA, table: 'waitlists' },
  { schema: SCHEDULING_SCHEMA, table: 'practitioners' },
  { schema: SCHEDULING_SCHEMA, table: 'agenda' },
  { schema: NOTIFICATION_SCHEMA, table: 'notifications' },
  { schema: NOTIFICATION_SCHEMA, table: 'reminders' },
  { schema: NOTIFICATION_SCHEMA, table: 'contacts', key: 'recipient_id' },
  { schema: ANALYTICS_SCHEMA, table: 'outcomes' },
];

/**
 * What the migration `20261013120000_keep-the-network-of-every-row` does: every table of the
 * contexts gets the network of its rows, those already there going to `tenantOfExistingRows`,
 * the network the database served; the outbox keeps the network of each event, the events not
 * published yet going to that network too, so that their consumers run in it; so do the instances
 * of the process managers and the background jobs not finished yet, so that their next step runs
 * in it. A table that has the column already is left alone, so that the migration also runs on a
 * database the first migration built from the current schema.
 */
export async function keepTheNetworkOfEveryRow(knex: Knex, tenantOfExistingRows?: string): Promise<void> {
  const existing = tenantOfExistingRows === undefined || tenantOfExistingRows === '' ? {} : { tenantOfExistingRows };

  for (const table of TABLES_OF_ONE_CUSTOMER) {
    await addTenantColumn(knex, { ...table, ...existing });
  }

  if (!(await knex.schema.withSchema(MESSAGING).hasColumn(OUTBOX_TABLE, 'tenant_id'))) {
    await addOutboxTenantColumn(knex, { schema: MESSAGING, ...unpublishedOf(existing) });
  }

  if (await knex.schema.withSchema(MESSAGING).hasTable(PROCESS_TABLE)) {
    await addTenantColumn(knex, { schema: MESSAGING, table: PROCESS_TABLE, ...existing });
  }

  if (existing.tenantOfExistingRows !== undefined && (await knex.schema.withSchema(MESSAGING).hasTable(JOB_TABLE))) {
    await giveUnfinishedJobs(knex, existing.tenantOfExistingRows);
  }
}

/**
 * The jobs waiting or running, enqueued before any network was named: their next attempt runs in
 * the network of the database, read from who enqueued them, as a job enqueued now would.
 */
async function giveUnfinishedJobs(knex: Knex, network: string): Promise<void> {
  await knex(JOB_TABLE)
    .withSchema(MESSAGING)
    .where({ tenant_id: '' })
    .whereIn('status', ['waiting', 'running'])
    .update({
      tenant_id: network,
      enqueued_by: knex.raw("jsonb_set(??, '{tenantId}', to_jsonb(?::text))", ['enqueued_by', network]),
    });
}

function unpublishedOf(existing: { readonly tenantOfExistingRows?: string }): {
  readonly tenantOfUnpublished?: string;
} {
  return existing.tenantOfExistingRows === undefined ? {} : { tenantOfUnpublished: existing.tenantOfExistingRows };
}
