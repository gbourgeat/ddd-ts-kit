import type { Actor } from '../actor/actor.js';

/**
 * What travels with a background job from the work that enqueued it to its run: the run belongs
 * to the same correlation and the same trace, acts as the same actor and for the same tenant.
 */
export interface EnqueuedBy {
  readonly correlationId: string;
  readonly actor: Actor;
  readonly tenantId?: string;
  /** W3C `traceparent` of the span that enqueued it, when tracing is on. */
  readonly traceparent?: string;
}
