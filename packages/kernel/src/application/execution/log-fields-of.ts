import type { LogFields } from '../logging/log-fields.js';
import type { ExecutionContext } from './execution-context.js';

/** The identifiers a log line needs to be found again, impersonation included. Never content. */
export function logFieldsOf(context: ExecutionContext): LogFields {
  return {
    correlationId: context.correlationId,
    origin: context.origin,
    actorId: context.actor.id,
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
    ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
    ...(context.elevation === undefined ? {} : { elevation: context.elevation.reason }),
    ...(context.session?.impersonatedBy === undefined ? {} : { impersonatedBy: context.session.impersonatedBy }),
  };
}
