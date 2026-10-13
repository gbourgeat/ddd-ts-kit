import { isAnonymous, type AuditTrail } from '@ddd-ts-kit/kernel';
import type { AuditSource } from './audit-source.js';
import type { GuardRefusalOfARoute } from './guard-refusal-of-a-route.js';
import { recordIn } from './record-in.js';

/**
 * The `onGuardRefusal` hook of the HTTP pipeline: a request a guard refused at the edge
 * (`HasRole`, `HasScope`, `TenantMember`, a tenant the caller does not belong to) is a denied
 * authorization decision like one of the use cases, recorded with action `http:<operationId>`,
 * the code of the refusal as reason, and who, in which session and tenant, from the request.
 *
 * A caller that presented no credential is not recorded: it is no one to hold to account, its
 * tenant is whatever it addressed, and recording it would let unauthenticated traffic write to
 * the trail without bound. Those refusals belong to the access log and to rate limiting. A
 * recorded refusal is in the tenant of the credential of the caller, never in the one it asked.
 */
export function auditGuardRefusals(
  trail: AuditTrail,
  source: Omit<AuditSource, 'scope'>,
): (refusal: GuardRefusalOfARoute) => Promise<void> {
  return async (refusal) => {
    if (isAnonymous(refusal.execution.actor)) {
      return;
    }

    await trail.record(
      recordIn(refusal.execution, source, {
        category: 'authorization',
        action: `http:${refusal.operationId}`,
        outcome: 'denied',
        reason: refusal.problem.code ?? (refusal.problem.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN'),
      }),
    );
  };
}
