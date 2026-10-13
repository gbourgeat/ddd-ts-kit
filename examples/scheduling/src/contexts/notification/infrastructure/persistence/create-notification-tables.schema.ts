// ddd-ts-kit:imports
import type { Knex } from 'knex';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { auditColumns, readModelColumns, tenantColumn } from '@ddd-ts-kit/knex';
// /ddd-ts-kit:imports

export async function createNotificationTables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(NOTIFICATION_SCHEMA);
  // ddd-ts-kit:tables
  await createNotificationTable(knex);
  await createReminderTable(knex);
  await createContactTable(knex);
  // /ddd-ts-kit:tables
}

// ddd-ts-kit:definitions
function createNotificationTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(NOTIFICATION_SCHEMA).createTable('notifications', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('recipient_id').notNullable();
    table.text('kind').notNullable();
    table.text('appointment_id').notNullable();
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.text('cause').notNullable();
    // A cause is told once to each recipient, whatever the number of deliveries of the fact behind it.
    table.unique(['cause', 'recipient_id']);
    table.index(['recipient_id', 'registered_at', 'id']);
    table.integer('version').notNullable();
    tenantColumn(table);
    table.index(['tenant_id', 'id'], 'notifications_tenant_idx');
    auditColumns(table);
  });
}

function createReminderTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(NOTIFICATION_SCHEMA).createTable('reminders', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('appointment_id').notNullable().unique();
    table.text('recipient_id').notNullable();
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('due_at', { useTz: true }).notNullable();
    table.text('status').notNullable();
    table.index(['status', 'due_at']);
    table.integer('version').notNullable();
    tenantColumn(table);
    table.index(['tenant_id', 'id'], 'reminders_tenant_idx');
    auditColumns(table);
  });
}

/** The read model of the contacts projection: one row per recipient, stamped by the event that last changed it. */
function createContactTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(NOTIFICATION_SCHEMA).createTable('contacts', (table) => {
    table.text('recipient_id').primary();
    table.text('address').notNullable();
    tenantColumn(table);
    table.index(['tenant_id', 'recipient_id'], 'contacts_tenant_idx');
    readModelColumns(table);
  });
}
// /ddd-ts-kit:definitions
