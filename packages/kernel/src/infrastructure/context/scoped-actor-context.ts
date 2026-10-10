import type { Actor } from '../../application/actor/actor.js';
import { NoCurrentActorError } from '../../application/actor/no-current-actor-error.js';
import { executionContext } from '../../application/execution/execution-context.js';
import { withActor } from '../../application/execution/with-actor.js';
import type { ActorContext } from '../../application/ports/actor-context.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';

/**
 * The `ActorContext` of an application that has an execution scope: one source of truth, so
 * the two cannot disagree. The current actor is the actor of the current execution context;
 * `run(actor, work)` runs the work in the current context seen as that actor, or opens a
 * context of origin `internal` when there is none.
 */
export class ScopedActorContext implements ActorContext {
  constructor(
    private readonly scope: ExecutionScope,
    private readonly correlationIds: IdGenerator,
  ) {}

  current(): Actor | undefined {
    return this.scope.current()?.actor;
  }

  require(): Actor {
    const actor = this.current();

    if (actor === undefined) throw new NoCurrentActorError();

    return actor;
  }

  run<T>(actor: Actor, work: () => T): T {
    const current = this.scope.current();

    const context =
      current === undefined
        ? executionContext({ correlationId: this.correlationIds.next(), actor, origin: 'internal' })
        : withActor(current, actor);

    return this.scope.run(context, work);
  }
}
