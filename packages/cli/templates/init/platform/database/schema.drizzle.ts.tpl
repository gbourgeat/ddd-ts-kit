{{#if audit.on}}
import { auditChainsTable, auditEntriesTable } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
import { outboxTable, processedEventsTable } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging');
export const processedEvents = processedEventsTable('messaging');
{{#if audit.on}}

/** The schema of the audit trail. */
export const AUDIT_SCHEMA = 'audit';

// TODO(platform): drizzle-kit writes no trigger. After the first `npm run db:generate <name>`, add a custom migration (`npm run db:generate -- audit-guard --custom`) holding the statements `npm run db:audit-guard` prints: they make the entries refuse UPDATE, DELETE and TRUNCATE.
export const auditEntries = auditEntriesTable(AUDIT_SCHEMA);
export const auditChains = auditChainsTable(AUDIT_SCHEMA);
{{/if}}

// ddd-ts-kit:schemas
// /ddd-ts-kit:schemas
