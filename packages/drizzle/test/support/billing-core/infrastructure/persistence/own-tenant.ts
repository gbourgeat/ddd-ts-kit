import { eq, type SQL } from 'drizzle-orm';
import { tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { invoices } from './invoices';

export function ownTenant(scope: ExecutionScope): SQL {
  return eq(invoices.tenantId, tenantScopeOf(scope).tenantId);
}
