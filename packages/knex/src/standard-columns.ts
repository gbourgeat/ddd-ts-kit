import type { Knex } from 'knex';
import type { AuditStamp, TenantScoped, UpdateStamp } from '@ddd-ts-kit/kernel';

/** The audit columns as knex reads and writes them: the keys are the column names. */
export interface AuditRow {
  created_at: Date;
  created_by: string;
  updated_at: Date;
  updated_by: string;
}

export type UpdateAuditRow = Pick<AuditRow, 'updated_at' | 'updated_by'>;

export interface TenantRow {
  tenant_id: string;
}

// Bounded strings because MySQL cannot index unbounded text, and both columns are filtered on.
const ACTOR_LENGTH = 191;
const INSTANT = { useTz: true, precision: 3 } as const;

/**
 * Adds the four audit columns to a table being created, under the same names in every project:
 * `created_at`, `created_by`, `updated_at`, `updated_by`. Fill them with `auditRow`.
 */
export function auditColumns(table: Knex.CreateTableBuilder): void {
  table.datetime('created_at', INSTANT).notNullable();
  table.string('created_by', ACTOR_LENGTH).notNullable();
  table.datetime('updated_at', INSTANT).notNullable();
  table.string('updated_by', ACTOR_LENGTH).notNullable();
}

/** Adds the tenant column, `tenant_id`. Fill it and filter on it with `tenantRow`. */
export function tenantColumn(table: Knex.CreateTableBuilder): void {
  table.string('tenant_id', ACTOR_LENGTH).notNullable();
}

/**
 * The kernel stamp under the column names: `auditRow(stampCreation(scope, clock))` for an
 * insert, `auditRow(stampUpdate(scope, clock))` for an update, which leaves the creation alone.
 */
export function auditRow(stamp: AuditStamp): AuditRow;
export function auditRow(stamp: UpdateStamp): UpdateAuditRow;
export function auditRow(stamp: AuditStamp | UpdateStamp): AuditRow | UpdateAuditRow {
  const updated: UpdateAuditRow = { updated_at: stamp.updatedAt, updated_by: stamp.updatedBy };
  return 'createdAt' in stamp ? { created_at: stamp.createdAt, created_by: stamp.createdBy, ...updated } : updated;
}

/** `tenantScopeOf(scope)` under the column name: spread it into an insert and into every `where`. */
export function tenantRow(scoped: TenantScoped): TenantRow {
  return { tenant_id: scoped.tenantId };
}
