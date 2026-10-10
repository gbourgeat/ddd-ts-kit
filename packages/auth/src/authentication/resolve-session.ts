import type { Session } from '@ddd-ts-kit/kernel';
import type { Authenticator } from './authenticator.js';
import type { SessionAuthenticator } from './session-authenticator.js';
import { sessionOf } from './session-of.js';

/**
 * The session of a credential, whatever the authenticator: its own when it is a
 * `SessionAuthenticator`, otherwise one derived from the actor (see `sessionOf`).
 */
export async function resolveSession(
  authenticator: Authenticator | SessionAuthenticator,
  credential: string | undefined,
): Promise<Session> {
  if ('authenticateSession' in authenticator) return authenticator.authenticateSession(credential);

  return sessionOf(await authenticator.authenticate(credential));
}
