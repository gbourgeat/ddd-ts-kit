import type { AuditRecord } from '../audit/audit-record.js';
import type { ExecutionContext } from '../execution/execution-context.js';
import type { ElevationOptions } from './elevation-options.js';
import { InvalidTenantElevationError } from './invalid-tenant-elevation-error.js';
import { isTenantId } from './is-tenant-id.js';
import type { TenantElevation } from './tenant-elevation.js';

/** The action of the audit entry an elevation writes. */
export const TENANT_ELEVATION_ACTION = 'tenancy:elevate';

/**
 * Runs `work` with reads widened to the tenants of `elevation`, for platform staff. Never
 * implicit: the platform calls it after the permission to elevate was decided, and the
 * elevation is written to the audit trail before the work starts; a trail that fails refuses
 * the elevation. Writes still name one tenant (`tenantScopeOf`).
 */
export async function acrossTenants<T>(
  options: ElevationOptions,
  elevation: TenantElevation,
  work: () => Promise<T>,
): Promise<T> {
  assertValid(elevation);

  const context = options.scope.require();

  await options.trail.record(elevationRecord(options, context, elevation));

  return options.scope.run(Object.freeze({ ...context, elevation }), work);
}

function assertValid({ reason, tenants }: TenantElevation): void {
  if (reason.trim() === '') {
    throw new InvalidTenantElevationError('it names no reason');
  }

  if (tenants !== 'all' && tenants.length === 0) {
    throw new InvalidTenantElevationError('it names no tenant');
  }

  if (tenants !== 'all' && !tenants.every(isTenantId)) {
    throw new InvalidTenantElevationError('it names a tenant id outside the grammar of isTenantId');
  }
}

function elevationRecord(
  options: ElevationOptions,
  context: ExecutionContext,
  elevation: TenantElevation,
): AuditRecord {
  const { tenantId, session } = context;

  return {
    id: options.ids.next(),
    occurredAt: options.clock.now(),
    category: 'authorization',
    action: TENANT_ELEVATION_ACTION,
    outcome: 'allowed',
    reason: elevation.reason,
    actor: { id: context.actor.id, type: context.actor.type },
    resource: { type: 'tenants', id: elevation.tenants === 'all' ? '*' : elevation.tenants.join(',') },
    correlationId: context.correlationId,
    origin: context.origin,
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(session === undefined ? {} : { sessionId: session.id }),
    ...(session?.impersonatedBy === undefined ? {} : { impersonatedBy: session.impersonatedBy }),
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
  };
}
