import type { AuditStamp, UpdateStamp } from '@ddd-ts-kit/kernel';

/** The audit columns as knex reads and writes them: the keys are the column names. */
export interface AuditRow {
  created_at: Date;
  created_by: string;
  updated_at: Date;
  updated_by: string;
}

export type UpdateAuditRow = Pick<AuditRow, 'updated_at' | 'updated_by'>;

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
