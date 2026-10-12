import type { Knex } from 'knex';
import { createAuditTables } from '@ddd-ts-kit/audit/knex';
import { createOutboxTables } from '@ddd-ts-kit/knex';
import { createRelationTupleTables } from '@/platform/auth/create-relation-tuple-tables';
// ddd-ts-kit:imports
import { createSchedulingTables } from '@/contexts/scheduling/infrastructure/persistence/create-scheduling-tables.schema';
import { createIdentityTables } from '@/contexts/identity/infrastructure/persistence/create-identity-tables.schema';
import { createNotificationTables } from '@/contexts/notification/infrastructure/persistence/create-notification-tables.schema';
import { createAnalyticsTables } from '@/contexts/analytics/infrastructure/persistence/create-analytics-tables.schema';
// /ddd-ts-kit:imports

export const MESSAGING = 'messaging';
/** The schema of the audit trail: two tables, and the triggers that keep the entries append-only. */
export const AUDIT_SCHEMA = 'audit';
/** The schema of the relation tuples the authorizer reads. */
export const AUTHORIZATION_SCHEMA = 'authorization';

/**
 * Every table of the application. The first migration (migrations/00000000000000_initial.js) and the
 * in-process database of the tests both call it; once a database is shared, a change of an
 * existing table goes into a migration of its own (`npm run db:generate <what-it-does>`).
 */
export const createTables = async (knex: Knex): Promise<void> => {
  await createOutboxTables(knex, { schema: MESSAGING });
  await createAuditTables(knex, { schema: AUDIT_SCHEMA });
  await createRelationTupleTables(knex, { schema: AUTHORIZATION_SCHEMA });
  // ddd-ts-kit:schemas
  await createSchedulingTables(knex);
  await createIdentityTables(knex);
  await createNotificationTables(knex);
  await createAnalyticsTables(knex);
  // /ddd-ts-kit:schemas
};
