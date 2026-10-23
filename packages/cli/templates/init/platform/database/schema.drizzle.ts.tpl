{{#if audit.on}}
import { auditChainsTable, auditEntriesTable } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
{{#if tenancy.any}}
import { {{#if queue.database}}jobsTable, {{/if}}processedEventsTable{{#if queue.processTable}}, processesTable{{/if}}, tenantOutboxTable } from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless tenancy.any}}
import { {{#if queue.database}}jobsTable, {{/if}}outboxTable, processedEventsTable{{#if queue.processTable}}, processesTable{{/if}} } from '@ddd-ts-kit/drizzle/postgres';
{{/unless}}

/** The schema of what the kit stores for the application: the outbox and the processed events{{#if queue.database}}, the background jobs{{/if}}{{#if queue.processTable}}, the process instances{{/if}}. */
export const MESSAGING_SCHEMA = 'messaging';

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

// TODO(platform): drizzle-kit writes no trigger. After the first `npm run db:generate <name>`, add a custom migration (`npm run db:generate -- audit-guard --custom`) holding the statements `npm run db:audit-guard` prints: they make the entries refuse UPDATE, DELETE and TRUNCATE.
export const auditEntries = auditEntriesTable(AUDIT_SCHEMA);
export const auditChains = auditChainsTable(AUDIT_SCHEMA);
{{/if}}

// ddd-ts-kit:schemas
// /ddd-ts-kit:schemas
