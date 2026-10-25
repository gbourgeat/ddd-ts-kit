import type { Actor } from '@ddd-ts-kit/kernel';

export interface PassportPrincipalOptions {
  /**
   * The actor the user a strategy authenticated stands for: what the verify callback of the
   * strategy, or `validate` of a strategy of Nest, handed to `done`, with its `info`. The user
   * comes from outside the kit: read it, as a mapper reads what enters.
   */
  readonly actorOf: (user: unknown, info: unknown) => Actor | Promise<Actor>;
  /**
   * Whether the request presents a credential at all. A strategy that fails a request that does
   * refuses it (401); one that fails a request that does not lets it through anonymous, for the
   * guards of the route to decide. Left out: an `Authorization` header.
   */
  readonly presented?: (raw: unknown) => boolean;
  /** How long a strategy may take to answer before the call is refused. Left out: 10 seconds. */
  readonly timeoutMs?: number;
}
