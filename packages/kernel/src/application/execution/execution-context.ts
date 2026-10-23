import type { Actor } from '../actor/actor';
import type { Session } from '../session/session';
import { assertTenantId } from '../tenancy/assert-tenant-id';
import type { TenantElevation } from '../tenancy/tenant-elevation';
import type { ExecutionContextExtensionValues } from './execution-context-extension-values';
import type { ExecutionOrigin } from './execution-origin';

/**
 * What every unit of work carries, whatever started it: an HTTP request, a consumed event, a
 * scheduled job, a CLI command. Plain data, set once at the boundary.
 */
export interface ExecutionContext {
  /** The same for everything one external stimulus causes, across processes. */
  readonly correlationId: string;
  /** Id of the message or request that directly caused this unit of work. */
  readonly causationId?: string;
  readonly actor: Actor;
  readonly session?: Session;
  readonly tenantId?: string;
  /** Platform staff reading over tenants, opened by `acrossTenants` and audited. Absent otherwise. */
  readonly elevation?: TenantElevation;
  readonly locale?: string;
  /** The instant after which the result is useless to the caller. */
  readonly deadline?: Date;
  /** For the origin `schedule`: the instant the job was due, which is not the instant it started. */
  readonly scheduledAt?: Date;
  readonly origin: ExecutionOrigin;
  readonly extensions: ExecutionContextExtensionValues;
}

export type ExecutionContextInit = Omit<ExecutionContext, 'extensions' | 'tenantId'> &
  Partial<Pick<ExecutionContext, 'extensions' | 'tenantId'>>;

/**
 * Fills what can be derived: the tenant of the actor, no extension. A tenant id outside the
 * grammar of `isTenantId` is refused (`InvalidTenantIdError`), whatever named it.
 */
export function executionContext(init: ExecutionContextInit): ExecutionContext {
  const named = init.tenantId ?? init.actor.tenantId;
  const tenantId = named === undefined ? undefined : assertTenantId(named);

  return Object.freeze({
    ...init,
    ...(tenantId === undefined ? {} : { tenantId }),
    extensions: init.extensions ?? Object.freeze({}),
  });
}
