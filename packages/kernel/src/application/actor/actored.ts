import type { Actor } from './actor';

/** What a protected use case carries: the actor is data of the message, never ambient state. */
export interface Actored {
  readonly actor: Actor;
}
