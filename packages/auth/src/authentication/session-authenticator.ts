import type { Session } from '@ddd-ts-kit/kernel';
import { Authenticator } from './authenticator.js';

/**
 * An authenticator that also knows the session the credential stands for: since when, until
 * when, how it was authenticated, on whose behalf. Answers the anonymous session without
 * credential. `resolveSession` works with either port, so an adapter implements this one only
 * when its credential carries that knowledge.
 */
export abstract class SessionAuthenticator extends Authenticator {
  static override readonly tokenKey = 'auth.SessionAuthenticator';

  abstract authenticateSession(credential: string | undefined): Promise<Session>;
}
