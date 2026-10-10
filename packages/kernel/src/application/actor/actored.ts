import type { Actor } from './actor.js';

/** What a protected use case carries: the actor is data of the message, never ambient state. */
export interface Actored {
  readonly actor: Actor;
}
