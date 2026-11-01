import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { scopeOr } from './scope-or';

/**
 * The execution scope of the runtime when the work in progress names a tenant, otherwise nothing.
 * A runtime without a scope is refused: the tenant of the work cannot be told.
 */
export function tenantScopeOfWork(): ExecutionScope | undefined {
  const scope = scopeOr();

  return scope.current()?.tenantId === undefined ? undefined : scope;
}
