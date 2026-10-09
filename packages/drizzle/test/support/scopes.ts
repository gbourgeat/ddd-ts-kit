import { FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';

export const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
export const bob: Actor = { id: 'bob', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
export const eve: Actor = { id: 'eve', type: 'user', tenantId: 'globex', roles: [], attributes: {} };
export const nobody: Actor = { id: 'job', type: 'service', roles: [], attributes: {} };

/** The execution scope of a request made by `actor`, as the HTTP boundary would have opened it. */
export function scopeOf(actor: Actor): FixedExecutionScope {
  return new FixedExecutionScope(executionContext({ correlationId: 'corr-1', actor, origin: 'http' }));
}
