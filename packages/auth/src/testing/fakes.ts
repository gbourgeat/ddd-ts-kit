import type { Actor, Session } from '@ddd-ts-kit/kernel';
import { sessionOf, type SessionAuthenticator } from '../authentication.js';
import {
  ALLOWED,
  deny,
  type AccessScope,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type ListRequest,
} from '../authorizer.js';
import { InvalidCredentialError } from '../errors.js';

/** For the specs that are not about rights: everything is granted to everybody. */
export class AllowAll implements Authorizer {
  async check(): Promise<Decision> {
    return ALLOWED;
  }

  async listAccessible(): Promise<AccessScope> {
    return { kind: 'all' };
  }
}

export class DenyAll implements Authorizer {
  constructor(private readonly reason = 'DENIED_BY_TEST') {}

  async check(): Promise<Decision> {
    return deny(this.reason);
  }

  async listAccessible(): Promise<AccessScope> {
    return { kind: 'none' };
  }
}

/** Keeps what it was asked, as data, and answers what the wrapped authorizer answers. */
export class RecordingAuthorizer implements Authorizer {
  readonly checks: CheckRequest[] = [];
  readonly listings: ListRequest[] = [];

  constructor(private readonly answering: Authorizer = new AllowAll()) {}

  async check(request: CheckRequest): Promise<Decision> {
    this.checks.push(request);
    return this.answering.check(request);
  }

  async listAccessible(request: ListRequest): Promise<AccessScope> {
    this.listings.push(request);
    return (await this.answering.listAccessible?.(request)) ?? { kind: 'none' };
  }
}

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
    if (credential === undefined) return sessionOf(undefined);
    const principal = this.principals[credential];
    if (principal === undefined) throw new InvalidCredentialError('UNKNOWN_CREDENTIAL');
    return sessionOf(principal);
  }
}
