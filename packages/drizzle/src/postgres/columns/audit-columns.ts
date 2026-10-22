import { text } from 'drizzle-orm/pg-core';
import { instant } from './instant';

/**
 * The four audit columns, to spread into a table definition. Their keys are those of the
 * kernel `AuditStamp`, so `stampCreation(scope, clock)` spreads into an insert as it is, and
 * their names (`created_at`, `created_by`, `updated_at`, `updated_by`) are the same in every
 * project.
 */
export function auditColumns() {
  return {
    createdAt: instant('created_at').notNull(),
    createdBy: text('created_by').notNull(),
    updatedAt: instant('updated_at').notNull(),
    updatedBy: text('updated_by').notNull(),
  };
}
