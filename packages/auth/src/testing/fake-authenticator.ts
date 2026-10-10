import type { Actor, Session } from '@ddd-ts-kit/kernel';
import type { SessionAuthenticator } from '../authentication/session-authenticator.js';
import { sessionOf } from '../authentication/session-of.js';
import { InvalidCredentialError } from '../errors/invalid-credential-error.js';

/**
 * Knows a few credentials by heart, each standing for an actor or for a whole session:
 * `new FakeAuthenticator({ 'token-of-ada': ada, 'token-of-support': aSession().of(bob).build() })`.
 */
export class FakeAuthenticator implements SessionAuthenticator {
  constructor(private readonly principals: Readonly<Record<string, Actor | Session>>) {}

  async authenticate(credential: string | undefined): Promise<Actor> {
    return (await this.authenticateSession(credential)).actor;
  }

  async authenticateSession(credential: string | undefined): Promise<Session> {
    if (credential === undefined) {
      return sessionOf(undefined);
    }

    const principal = this.principals[credential];

    if (principal === undefined) {
      throw new InvalidCredentialError('UNKNOWN_CREDENTIAL');
    }

    return sessionOf(principal);
  }
}
