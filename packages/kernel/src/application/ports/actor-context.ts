import type { Actor } from '../actor/actor.js';

/**
 * The actor of the request or message being processed, for infrastructure that is not handed
 * it: audit columns, tenant scoping of every statement. Set once at the boundary with `run`.
 * Handlers and the domain take the actor from the command or query instead.
 */
export abstract class ActorContext {
  static readonly tokenKey = 'kernel.ActorContext';

  abstract current(): Actor | undefined;

  /** Throws `NoCurrentActorError` outside of `run`. */
  abstract require(): Actor;

  abstract run<T>(actor: Actor, work: () => T): T;
}
