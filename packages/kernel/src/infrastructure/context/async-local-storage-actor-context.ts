import { AsyncLocalStorage } from 'node:async_hooks';
import type { Actor } from '../../application/actor/actor';
import type { ActorContext } from '../../application/ports/actor-context';
import { requiredActor } from './required-actor';

/** Follows the asynchronous call chain started by `run`, so concurrent requests never mix. */
export class AsyncLocalStorageActorContext implements ActorContext {
  private readonly storage = new AsyncLocalStorage<Actor>();

  current(): Actor | undefined {
    return this.storage.getStore();
  }

  require(): Actor {
    return requiredActor(this.current());
  }

  run<T>(actor: Actor, work: () => T): T {
    return this.storage.run(actor, work);
  }
}
