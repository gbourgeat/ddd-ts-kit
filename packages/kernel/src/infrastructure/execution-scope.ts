import { AsyncLocalStorage } from 'node:async_hooks';
import { NoCurrentActorError, type Actor, type ActorContext } from '../application/actor.js';
import {
  NoExecutionContextError,
  executionContext,
  withActor,
  type ExecutionContext,
  type ExecutionScope,
} from '../application/execution-context.js';
import type { IdGenerator } from '../application/ports.js';
import type { FixedActorContext } from './actor-context.js';

/** Follows the asynchronous call chain started by `run`, so concurrent requests never mix. */
export class AsyncLocalStorageExecutionScope implements ExecutionScope {
  readonly #storage = new AsyncLocalStorage<ExecutionContext>();

  current(): ExecutionContext | undefined {
    return this.#storage.getStore();
  }

  require(): ExecutionContext {
    return required(this.current());
  }

  run<T>(context: ExecutionContext, work: () => T): T {
    return this.#storage.run(context, work);
  }
}

/**
 * The test double: answers the context it was given. `run` switches to another context until
 * the work is over, without isolating concurrent runs, which a test does not need.
 *
 * Given a `FixedActorContext`, the two follow each other: the scope answers the actor of the
 * actor context, and running or entering a context moves the actor context too.
 */
export class FixedExecutionScope implements ExecutionScope {
  #context: ExecutionContext | undefined;
  readonly #actors: FixedActorContext | undefined;

  constructor(context?: ExecutionContext, actors?: FixedActorContext) {
    this.#context = context;
    this.#actors = actors;
  }

  current(): ExecutionContext | undefined {
    const actor = this.#actors?.current();
    if (this.#context === undefined || actor === undefined) return this.#context;
    return withActor(this.#context, actor);
  }

  require(): ExecutionContext {
    return required(this.current());
  }

  run<T>(context: ExecutionContext, work: () => T): T {
    const previous = this.#context;
    this.#context = context;
    const restore = (): void => {
      this.#context = previous;
    };
    const aligned = this.#actors;
    return restoring(aligned === undefined ? work : () => aligned.run(context.actor, work), restore);
  }

  enter(context: ExecutionContext): void {
    this.#context = context;
    this.#actors?.actAs(context.actor);
  }
}

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

function required(context: ExecutionContext | undefined): ExecutionContext {
  if (context === undefined) throw new NoExecutionContextError();
  return context;
}

function restoring<T>(work: () => T, restore: () => void): T {
  let outcome: T;
  try {
    outcome = work();
  } catch (error) {
    restore();
    throw error;
  }
  if (outcome instanceof Promise) outcome.then(restore, restore);
  else restore();
  return outcome;
}
