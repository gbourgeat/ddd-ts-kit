import type { Knex } from 'knex';
{{#if audit.on}}
import { createAuditTables } from '@ddd-ts-kit/audit/knex';
{{/if}}
import { createEventStoreTables, {{#if queue.database}}createJobTable, {{/if}}createOutboxTables{{#if queue.processTable}}, createProcessTable{{/if}} } from '@ddd-ts-kit/knex';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The schema of what the kit stores for the application: the outbox and the processed events{{#if queue.database}}, the background jobs{{/if}}{{#if queue.processTable}}, the process instances{{/if}}. */
export const MESSAGING_SCHEMA = 'messaging';
/** The schema of the event store: the events, the snapshots, the checkpoints and the keys of the data subjects. It records no tenant. */
export const EVENT_STORE_SCHEMA = 'event_store';
{{#if audit.on}}
/** The schema of the audit trail: two tables, and the triggers that keep the entries append-only. */
export const AUDIT_SCHEMA = 'audit';
{{/if}}

/**
 * Every table of the application. The first migration (migrations/00000000000000_initial.js) and the
 * in-process database of the tests both call it; once a database is shared, a change of an
 * existing table goes into a migration of its own (`npm run db:generate <what-it-does>`).
 */
export const createTables = async (knex: Knex): Promise<void> => {
{{#if tenancy.any}}
  // The tenant of each event, so that its consumers run in that tenant.
  await createOutboxTables(knex, { schema: MESSAGING_SCHEMA, tenant: true });
{{/if}}
{{#unless tenancy.any}}
  await createOutboxTables(knex, { schema: MESSAGING_SCHEMA });
{{/unless}}
  {{#if queue.database}}
  await createJobTable(knex, { schema: MESSAGING_SCHEMA });
  {{/if}}
  {{#if queue.processTable}}
  await createProcessTable(knex, { schema: MESSAGING_SCHEMA });
  {{/if}}
  {{#if audit.on}}
  await createAuditTables(knex, { schema: AUDIT_SCHEMA });
  {{/if}}
  await createEventStoreTables(knex, { schema: EVENT_STORE_SCHEMA });
  // ddd-ts-kit:schemas
  // /ddd-ts-kit:schemas
};
