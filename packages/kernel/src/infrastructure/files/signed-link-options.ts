import type { Clock } from '../../application/ports/clock.js';

export interface SignedLinkOptions {
  /** Where `signedFileRoutes` of `@ddd-ts-kit/http` answers, as a client reaches it: `http://localhost:3000/files`. */
  readonly baseUrl?: string;
  /** Signs the links. Left out, a random one is drawn: the links then die with the process. */
  readonly secret?: string;
  /** Reads the expiry of the links. Default: the system clock. */
  readonly clock?: Clock;
}
