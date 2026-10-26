import { pgSchema } from 'drizzle-orm/pg-core';
{{#if audit.on}}
import { auditArchivesTable, auditChainsTable, auditEntriesTable } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
{{#if tenancy.any}}
import { {{#if eventSourcing.on}}eventStoreTables, {{/if}}{{#if queue.database}}jobsTable, {{/if}}processedEventsTable{{#if queue.processTable}}, processesTable{{/if}}, tenantOutboxTable } from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless tenancy.any}}
import { {{#if eventSourcing.on}}eventStoreTables, {{/if}}{{#if queue.database}}jobsTable, {{/if}}outboxTable, processedEventsTable{{#if queue.processTable}}, processesTable{{/if}} } from '@ddd-ts-kit/drizzle/postgres';
{{/unless}}

/** The schema of what the kit stores for the application: the outbox and the processed events{{#if queue.database}}, the background jobs{{/if}}{{#if queue.processTable}}, the process instances{{/if}}. */
export const MESSAGING_SCHEMA = 'messaging';

/** Exported, so that drizzle-kit writes its `CREATE SCHEMA` before the first table it holds. */
export const messaging = pgSchema(MESSAGING_SCHEMA);

{{#if tenancy.any}}
/** It keeps the tenant of each event, so that its consumers run in that tenant. */
export const outbox = tenantOutboxTable(MESSAGING_SCHEMA);
{{/if}}
{{#unless tenancy.any}}
export const outbox = outboxTable(MESSAGING_SCHEMA);
{{/unless}}
export const processedEvents = processedEventsTable(MESSAGING_SCHEMA);
{{#if queue.database}}

/** The background jobs, enqueued in the transaction of the command that asks for them. */
export const jobs = jobsTable(MESSAGING_SCHEMA);
{{/if}}
{{#if queue.processTable}}

/** The instances of the process managers, saved in the transaction of each step. */
export const processes = processesTable(MESSAGING_SCHEMA);
{{/if}}
{{#if audit.on}}

/** The schema of the audit trail. */
export const AUDIT_SCHEMA = 'audit';

/** Exported, so that drizzle-kit writes its `CREATE SCHEMA` before the first table it holds. */
export const audit = pgSchema(AUDIT_SCHEMA);

// drizzle-kit writes no trigger: `npm run db:generate <name>` adds the statements that make the audit trail append-only (UPDATE, DELETE and TRUNCATE refused) to the migration that creates it; `npm run db:audit-guard` prints them for a migration written by hand.
export const auditEntries = auditEntriesTable(AUDIT_SCHEMA);
export const auditChains = auditChainsTable(AUDIT_SCHEMA);
/** One row per range of a chain moved to the storage of files: the anchor the chain goes on from. */
export const auditArchives = auditArchivesTable(AUDIT_SCHEMA);
{{/if}}
{{#if eventSourcing.on}}

/** The schema of the event store: the events, the snapshots, the checkpoints and the keys of the data subjects. It records no tenant. */
export const EVENT_STORE_SCHEMA = 'event_store';

/** Exported, so that drizzle-kit writes its `CREATE SCHEMA` before the first table it holds. */
export const eventStoreSchema = pgSchema(EVENT_STORE_SCHEMA);

const eventStore = eventStoreTables(EVENT_STORE_SCHEMA);

export const storedEventsHead = eventStore.head;
export const storedEvents = eventStore.events;
export const streamSnapshots = eventStore.snapshots;
export const subscriptionCheckpoints = eventStore.checkpoints;
export const subjectKeys = eventStore.subjectKeys;
{{/if}}

// ddd-ts-kit:schemas
// /ddd-ts-kit:schemas
