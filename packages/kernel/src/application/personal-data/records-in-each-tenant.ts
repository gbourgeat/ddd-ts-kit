import type { ExecutionScope } from '../ports/execution-scope';
import { eachTenant } from './each-tenant';
import type { PersonalDataRecord } from './personal-data-record';

/**
 * How an export reaches the records of every tenant: the work runs once per tenant, in the
 * context of the work in progress given that tenant, and the records it answers are gathered in
 * the order of the tenants. A read of tenant data is confined to the tenant of its context, as a
 * write is, so this is the one way to export from every tenant. Needs a context to run in.
 */
export function recordsInEachTenant(
  scope: ExecutionScope,
  tenants: readonly string[],
): (work: () => Promise<readonly PersonalDataRecord[]>) => Promise<readonly PersonalDataRecord[]> {
  return async (work) => (await eachTenant(scope, tenants, work)).flat();
}
