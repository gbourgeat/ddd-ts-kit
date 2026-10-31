import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime';

/** The execution scope of the runtime when the work in progress names a tenant, otherwise nothing. */
export function tenantScopeOfWork(): ExecutionScope | undefined {
  const { scope } = currentRuntime();

  return scope?.current()?.tenantId === undefined ? undefined : scope;
}
