import { isSystem, isTenantId, isTenantMember } from '@ddd-ts-kit/kernel';
import type { CheckRequest } from '../authorization/check-request';
import type { Trace } from '../authorization/trace';

/** The tenant a request targets, or `undefined` when it targets none. See `tenantOfContext`. */
export type TenantOf = (request: CheckRequest) => string | undefined | Promise<string | undefined>;

/**
 * Whether the request stays in a tenant the actor may act in, said in one line of the trace:
 * the actor belongs to the tenant it targets, which is the one the work runs in when the work
 * runs in one. A system actor belongs to the tenant of its work, and to none outside of one.
 */
export async function tenantCheck(request: CheckRequest, tenantOf: TenantOf, trace: Trace): Promise<boolean> {
  const targeted = await tenantOf(request);
  const { actor, workTenantId } = request;

  if (targeted === undefined) {
    return trace.yes('the request targets no tenant');
  }

  if (!isTenantId(targeted)) {
    return trace.no(`"${String(targeted)}" is not a tenant id`);
  }

  if (workTenantId !== undefined && targeted !== workTenantId) {
    return trace.no(`the request targets ${targeted} while the work runs in ${workTenantId}`);
  }

  if (isTenantMember(actor, targeted)) {
    return trace.yes(`the actor belongs to ${targeted}, the tenant the request targets`);
  }

  if (isSystem(actor)) {
    return targeted === workTenantId
      ? trace.yes(`the system acts in ${targeted}, the tenant of its work`)
      : trace.no(`the system acts in the tenant of its work only, and this work runs in none`);
  }

  return trace.no(`the actor does not belong to ${targeted}, the tenant the request targets`);
}
