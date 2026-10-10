import { auditGuardSql } from '../sql/audit-guard-sql.js';

/**
 * drizzle-kit does not generate triggers: paste these statements in a custom migration
 * (`drizzle-kit generate --custom`) after the one that creates the tables. They make
 * `audit_entries` refuse UPDATE, DELETE and TRUNCATE.
 */
export function auditGuardStatements(schemaName?: string): string[] {
  return auditGuardSql(schemaName === undefined ? {} : { schema: schemaName });
}
