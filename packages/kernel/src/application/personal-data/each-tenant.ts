import { executionContext } from '../execution/execution-context';
import type { ExecutionScope } from '../ports/execution-scope';

/**
 * Runs the work once per tenant, in the context of the work in progress given that tenant (same
 * actor, same correlation, same origin), and answers what each run answered, in the order of the
 * tenants. Tenant data is confined to the tenant of its context and never widened by an elevation,
 * so this is the one way to reach every tenant. Needs a context to run in (`scope.require()`).
 */
export async function eachTenant<T>(
  scope: ExecutionScope,
  tenants: readonly string[],
  work: () => Promise<T>,
): Promise<T[]> {
  const current = scope.require();
  const answers: T[] = [];

  for (const tenantId of tenants) {
    answers.push(await scope.run(executionContext({ ...current, tenantId }), work));
  }

  return answers;
}
