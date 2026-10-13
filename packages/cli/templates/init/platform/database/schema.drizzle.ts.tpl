{{#if audit.on}}
import { auditChainsTable, auditEntriesTable } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
{{#if tenancy.any}}
import { {{#if queue.database}}jobsTable, {{/if}}processedEventsTable{{#if queue.processTable}}, processesTable{{/if}}, tenantOutboxTable } from '@ddd-ts-kit/drizzle/postgres';

/** It keeps the tenant of each event, so that its consumers run in that tenant. */
export const outbox = tenantOutboxTable('messaging');
{{/if}}
{{#unless tenancy.any}}
import { {{#if queue.database}}jobsTable, {{/if}}outboxTable, processedEventsTable{{#if queue.processTable}}, processesTable{{/if}} } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging');
{{/unless}}
export const processedEvents = processedEventsTable('messaging');
{{#if queue.database}}

/** The background jobs, in the schema of the messaging of the application. */
export const jobs = jobsTable('messaging');
{{/if}}
{{#if queue.processTable}}

/** The instances of the process managers. */
export const processes = processesTable('messaging');
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
