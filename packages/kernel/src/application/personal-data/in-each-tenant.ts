import { executionContext } from '../execution/execution-context';
import type { ExecutionScope } from '../ports/execution-scope';

/**
 * How an erasure reaches the copies of every tenant: the work runs once per tenant, in the
 * context of the work in progress given that tenant (same actor, same correlation, same origin),
 * and the rows it answers are summed. A write of tenant data is confined to the tenant of its
 * context and never widened by an elevation, so this is the one way to erase in every tenant.
 * Needs a context to run in (`scope.require()`): the operator, the correlation and the origin of
 * the erasure are its.
 */
export function inEachTenant(
  scope: ExecutionScope,
  tenants: readonly string[],
): (work: () => Promise<number>) => Promise<number> {
  return async (work) => {
    const current = scope.require();
    let total = 0;

    for (const tenantId of tenants) {
      total += await scope.run(executionContext({ ...current, tenantId }), work);
    }

    return total;
  };
}
