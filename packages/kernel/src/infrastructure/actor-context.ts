import { AsyncLocalStorage } from 'node:async_hooks';
import { NoCurrentActorError, type Actor, type ActorContext } from '../application/actor.js';

/** Follows the asynchronous call chain started by `run`, so concurrent requests never mix. */
export class AsyncLocalStorageActorContext implements ActorContext {
  readonly #storage = new AsyncLocalStorage<Actor>();

  current(): Actor | undefined {
    return this.#storage.getStore();
  }

  require(): Actor {
    return required(this.current());
  }

  run<T>(actor: Actor, work: () => T): T {
    return this.#storage.run(actor, work);
  }
}

/**
 * The test double: answers the actor it was given. `run` switches to another actor until the
 * work is over, without isolating concurrent runs, which a test does not need.
 */
export class FixedActorContext implements ActorContext {
  #actor: Actor | undefined;

  constructor(actor?: Actor) {
    this.#actor = actor;
  }

  current(): Actor | undefined {
    return this.#actor;
  }

  require(): Actor {
    return required(this.#actor);
  }

  run<T>(actor: Actor, work: () => T): T {
    const previous = this.#actor;
    const restore = (): void => {
      this.#actor = previous;
    };
    this.#actor = actor;
    const outcome = settle(work, restore);
    if (outcome instanceof Promise) outcome.then(restore, restore);
    else restore();
    return outcome;
  }

  actAs(actor: Actor): void {
    this.#actor = actor;
  }
}

function required(actor: Actor | undefined): Actor {
  if (actor === undefined) throw new NoCurrentActorError();
  return actor;
}

function settle<T>(work: () => T, onThrow: () => void): T {
  try {
    return work();
  } catch (error) {
    onThrow();
    throw error;
  }
}
