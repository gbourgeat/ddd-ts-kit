import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime';
import { missingCollaborator } from './missing-collaborator';

const WAY_OUT =
  'cached keeps its entries per tenant and reads the tenant from it: call installAspectRuntime({ scope }) in the composition root, or pass shared: true for an answer that depends on no tenant';

/** The execution scope of the runtime, which `cached` needs to confine its entries to a tenant. */
export function scopeOr(): ExecutionScope {
  return currentRuntime().scope ?? missingCollaborator('scope', WAY_OUT);
}
