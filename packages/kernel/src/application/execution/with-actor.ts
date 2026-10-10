import type { Actor } from '../actor/actor.js';
import type { ExecutionContext } from './execution-context.js';

/**
 * The same unit of work seen as another actor. The session goes: it was the previous actor's.
 * The tenant follows the new actor when it has one.
 */
export function withActor(context: ExecutionContext, actor: Actor): ExecutionContext {
  if (context.actor === actor) return context;

  const { session: _session, tenantId: _tenantId, ...rest } = context;
  const tenantId = actor.tenantId ?? context.tenantId;

  return Object.freeze({ ...rest, actor, ...(tenantId === undefined ? {} : { tenantId }) });
}
