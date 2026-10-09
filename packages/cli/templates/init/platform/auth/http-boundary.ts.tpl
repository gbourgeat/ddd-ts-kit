import { actorOf, type Authenticator } from '@ddd-ts-kit/auth';
import type { Actor, ActorContext } from '@ddd-ts-kit/kernel';
import { principalOf } from './authenticator.js';

/** What the HTTP adapter needs to know who is calling: handed to it for every route. */
export interface HttpBoundary {
  readonly resolvePrincipal: (raw: unknown) => Promise<Actor>;
  readonly withPrincipal: <T>(principal: unknown, work: () => Promise<T>) => Promise<T>;
}

/** A request is authenticated once, then handled inside the actor context, so infrastructure sees who acts. */
export function httpBoundary(authenticator: Authenticator, actors: ActorContext): HttpBoundary {
  return {
    resolvePrincipal: principalOf(authenticator),
    withPrincipal: (principal, work) => actors.run(actorOf(principal), work),
  };
}
