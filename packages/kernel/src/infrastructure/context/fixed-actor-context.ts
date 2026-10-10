import type { Actor } from '../../application/actor/actor.js';
import type { ActorContext } from '../../application/ports/actor-context.js';
import { requiredActor } from './required-actor.js';
import { restoring } from './restoring.js';

/**
 * The test double: answers the actor it was given. `run` switches to another actor until the
 * work is over, without isolating concurrent runs, which a test does not need.
 */
export class FixedActorContext implements ActorContext {
  private actor: Actor | undefined;

  constructor(actor?: Actor) {
    this.actor = actor;
  }

  current(): Actor | undefined {
    return this.actor;
  }

  require(): Actor {
    return requiredActor(this.actor);
  }

  run<T>(actor: Actor, work: () => T): T {
    const previous = this.actor;

    this.actor = actor;

    return restoring(work, () => {
      this.actor = previous;
    });
  }

  actAs(actor: Actor): void {
    this.actor = actor;
  }
}
