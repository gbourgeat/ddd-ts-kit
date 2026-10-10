import type { ExecutionContext } from '../../application/execution/execution-context.js';
import { withActor } from '../../application/execution/with-actor.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';
import type { FixedActorContext } from './fixed-actor-context.js';
import { requiredExecutionContext } from './required-execution-context.js';
import { restoring } from './restoring.js';

/**
 * The test double: answers the context it was given. `run` switches to another context until
 * the work is over, without isolating concurrent runs, which a test does not need.
 *
 * Given a `FixedActorContext`, the two follow each other: the scope answers the actor of the
 * actor context, and running or entering a context moves the actor context too.
 */
export class FixedExecutionScope implements ExecutionScope {
  private context: ExecutionContext | undefined;

  private readonly actors: FixedActorContext | undefined;

  constructor(context?: ExecutionContext, actors?: FixedActorContext) {
    this.context = context;
    this.actors = actors;
  }

  current(): ExecutionContext | undefined {
    const actor = this.actors?.current();

    if (this.context === undefined || actor === undefined) {
      return this.context;
    }

    return withActor(this.context, actor);
  }

  require(): ExecutionContext {
    return requiredExecutionContext(this.current());
  }

  run<T>(context: ExecutionContext, work: () => T): T {
    const previous = this.context;

    this.context = context;

    const restore = (): void => {
      this.context = previous;
    };

    const aligned = this.actors;

    return restoring(aligned === undefined ? work : () => aligned.run(context.actor, work), restore);
  }

  enter(context: ExecutionContext): void {
    this.context = context;
    this.actors?.actAs(context.actor);
  }
}
