import type { AuditTrail } from '@ddd-ts-kit/kernel';
import type { AuditSource } from './audit-source.js';
import type { GuardRefusalOfARoute } from './guard-refusal-of-a-route.js';
import { recordIn } from './record-in.js';

/**
 * The `onGuardRefusal` hook of the HTTP pipeline: a request a guard refused at the edge
 * (`HasRole`, `HasScope`, `TenantMember`, a tenant the caller does not belong to) is a denied
 * authorization decision like one of the use cases, recorded with action `http:<operationId>`,
 * the code of the refusal as reason, and who, in which session and tenant, from the request.
 */
export function auditGuardRefusals(
  trail: AuditTrail,
  source: Omit<AuditSource, 'scope'>,
): (refusal: GuardRefusalOfARoute) => Promise<void> {
  return (refusal) =>
    trail.record(
      recordIn(refusal.execution, source, {
        category: 'authorization',
        action: `http:${refusal.operationId}`,
        outcome: 'denied',
        reason: refusal.problem.code ?? (refusal.problem.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN'),
      }),
    );
}
