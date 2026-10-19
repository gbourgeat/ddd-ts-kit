import { principalResolver, type Authenticator } from '@ddd-ts-kit/auth';
import type { Session } from '@ddd-ts-kit/kernel';

/** Reads the bearer credential of a request and answers its session: who, since when, how it was authenticated. */
export function principalOf(authenticator: Authenticator): (raw: unknown) => Promise<Session> {
  return principalResolver(authenticator);
}
