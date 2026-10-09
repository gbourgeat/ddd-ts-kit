import type { ExecutionScope } from './execution-context.js';
import type { Clock } from './ports.js';

/** Who created and last changed a stored record, and when. Columns of the row, not of the aggregate. */
export interface AuditStamp {
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

/** A stored record that belongs to one tenant. */
export interface TenantScoped {
  readonly tenantId: string;
}

/** For a repository adapter inserting a row: the current actor and instant, as both stamps. */
export function stampCreation(scope: ExecutionScope, clock: Clock): AuditStamp {
  const by = scope.require().actor.id;
  const at = clock.now();
  return { createdAt: at, createdBy: by, updatedAt: at, updatedBy: by };
}

/** The two columns an `UPDATE` statement sets, for an adapter that does not read the row first. */
export type UpdateStamp = Pick<AuditStamp, 'updatedAt' | 'updatedBy'>;

/**
 * For a repository adapter updating a row. Given the stored stamp, answers it whole with the
 * creation part kept as it is; given none, answers the two columns to set.
 */
export function stampUpdate(scope: ExecutionScope, clock: Clock): UpdateStamp;
export function stampUpdate(stamp: AuditStamp, scope: ExecutionScope, clock: Clock): AuditStamp;
export function stampUpdate(
  ...args: [ExecutionScope, Clock] | [AuditStamp, ExecutionScope, Clock]
): UpdateStamp | AuditStamp {
  if (args.length === 2) return updateStamp(...args);
  const [stamp, scope, clock] = args;
  return { ...stamp, ...updateStamp(scope, clock) };
}

function updateStamp(scope: ExecutionScope, clock: Clock): UpdateStamp {
  return { updatedAt: clock.now(), updatedBy: scope.require().actor.id };
}

/** For a repository adapter scoping a statement: the tenant of the work in progress. */
export function tenantScopeOf(scope: ExecutionScope): TenantScoped {
  const { tenantId } = scope.require();
  if (tenantId === undefined) throw new NoCurrentTenantError();
  return { tenantId };
}

/** Tenant-scoped storage was reached by work that names no tenant: a wiring mistake. */
export class NoCurrentTenantError extends Error {
  constructor() {
    super('No current tenant: the execution context of this work names none');
    this.name = 'NoCurrentTenantError';
  }
}
