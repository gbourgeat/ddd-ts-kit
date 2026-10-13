import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { anExecutionContext } from './an-execution-context.js';

/**
 * Runs a block as the work of a member of a tenant: `await asTenant(scope, 'acme', () =>
 * invoices.save(invoice))`. The actor is a test user of that tenant, origin `test`.
 */
export function asTenant<T>(scope: ExecutionScope, tenantId: string, work: () => T): T {
  const member = { id: `member-of-${tenantId}`, type: 'user' as const, tenantId, roles: [], attributes: {} };

  return scope.run(anExecutionContext().as(member).ofTenant(tenantId).build(), work);
}
