import type { Knex } from 'knex';
{{#if audit.on}}
import { createAuditTables } from '@ddd-ts-kit/audit/knex';
{{/if}}
import { createOutboxTables } from '@ddd-ts-kit/knex';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export const MESSAGING = 'messaging';
{{#if audit.on}}
/** The schema of the audit trail: two tables, and the triggers that keep the entries append-only. */
export const AUDIT_SCHEMA = 'audit';
{{/if}}

/**
 * Every table of the application. The first migration (migrations/0001_initial.js) and the
 * in-process database of the tests both call it; once a database is shared, a change of an
 * existing table goes into a migration of its own (`npm run db:generate <name>`).
 */
export const createTables = async (knex: Knex): Promise<void> => {
  await createOutboxTables(knex, { schema: MESSAGING });
{{#if audit.on}}
  await createAuditTables(knex, { schema: AUDIT_SCHEMA });
{{/if}}
  // ddd-ts-kit:schemas
  // /ddd-ts-kit:schemas
};
