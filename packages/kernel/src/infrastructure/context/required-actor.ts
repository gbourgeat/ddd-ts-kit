import type { Actor } from '../../application/actor/actor';
import { NoCurrentActorError } from '../../application/actor/no-current-actor-error';

export function requiredActor(actor: Actor | undefined): Actor {
  if (actor === undefined) {
    throw new NoCurrentActorError();
  }

  return actor;
}
