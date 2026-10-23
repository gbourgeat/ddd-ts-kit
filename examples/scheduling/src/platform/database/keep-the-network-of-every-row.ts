import type { Knex } from 'knex';
import {
  JOB_TABLE,
  OUTBOX_TABLE,
  PROCESS_TABLE,
  addOutboxTenantColumn,
  addTenantColumn,
  type AddTenantColumnOptions,
} from '@ddd-ts-kit/knex';
import { MESSAGING_SCHEMA } from '@/platform/database/schema';
import { ANALYTICS_SCHEMA } from '@/contexts/analytics/infrastructure/persistence/analytics.schema';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

/** The tables of the contexts as they stood when the application became multi-tenant (ADR-0003). */
const TABLES_OF_ONE_NETWORK: readonly AddTenantColumnOptions[] = [
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
 * What the migration `20261013120000_keep-the-network-of-every-row` does (ADR-0003), so that the
 * in-process database of the tests runs it too. A table that has the column already is left
 * alone: the migration also runs on a database the first migration built from the current schema.
 */
export async function keepTheNetworkOfEveryRow(knex: Knex, networkOfExistingRows?: string): Promise<void> {
  const network = networkOfExistingRows === '' ? undefined : networkOfExistingRows;

  await giveTheTablesOfTheContextsANetwork(knex, network);
  await giveTheOutboxANetwork(knex, network);
  await giveTheProcessInstancesANetwork(knex, network);
  await giveTheUnfinishedJobsANetwork(knex, network);
}

/** Every row of the contexts belongs to a network; those already there go to the network the database served. */
async function giveTheTablesOfTheContextsANetwork(knex: Knex, network: string | undefined): Promise<void> {
  for (const table of TABLES_OF_ONE_NETWORK) {
    await addTenantColumn(knex, { ...table, ...existingRowsIn(network) });
  }
}

/** The outbox keeps the network of each event; the events not published yet go to that network too, so that their consumers run in it. */
async function giveTheOutboxANetwork(knex: Knex, network: string | undefined): Promise<void> {
  if (await knex.schema.withSchema(MESSAGING_SCHEMA).hasColumn(OUTBOX_TABLE, 'tenant_id')) {
    return;
  }

  await addOutboxTenantColumn(knex, {
    schema: MESSAGING_SCHEMA,
    ...(network === undefined ? {} : { tenantOfUnpublished: network }),
  });
}

/** The instances of the process managers keep the network of the work that started them, so that their next step runs in it. */
async function giveTheProcessInstancesANetwork(knex: Knex, network: string | undefined): Promise<void> {
  if (await knex.schema.withSchema(MESSAGING_SCHEMA).hasTable(PROCESS_TABLE)) {
    await addTenantColumn(knex, { schema: MESSAGING_SCHEMA, table: PROCESS_TABLE, ...existingRowsIn(network) });
  }
}

/**
 * The jobs waiting or running, enqueued before any network was named: their next attempt runs in
 * the network of the database, read from who enqueued them, as a job enqueued now would.
 */
async function giveTheUnfinishedJobsANetwork(knex: Knex, network: string | undefined): Promise<void> {
  if (network === undefined || !(await knex.schema.withSchema(MESSAGING_SCHEMA).hasTable(JOB_TABLE))) {
    return;
  }

  await knex(JOB_TABLE)
    .withSchema(MESSAGING_SCHEMA)
    .where({ tenant_id: '' })
    .whereIn('status', ['waiting', 'running'])
    .update({
      tenant_id: network,
      enqueued_by: knex.raw("jsonb_set(??, '{tenantId}', to_jsonb(?::text))", ['enqueued_by', network]),
    });
}

/** What the kit calls the tenant of the rows already there, the example calls their network; nothing when the database served none. */
function existingRowsIn(network: string | undefined): { readonly tenantOfExistingRows?: string } {
  return network === undefined ? {} : { tenantOfExistingRows: network };
}
