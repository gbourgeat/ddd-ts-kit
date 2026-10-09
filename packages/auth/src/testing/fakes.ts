import { anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import type { Authenticator } from '../authentication.js';
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

/** Knows a few credentials by heart: `new FakeAuthenticator({ 'token-of-ada': ada })`. */
export class FakeAuthenticator implements Authenticator {
  constructor(private readonly actors: Readonly<Record<string, Actor>>) {}

  async authenticate(credential: string | undefined): Promise<Actor> {
    if (credential === undefined) return anonymousActor();
    const actor = this.actors[credential];
    if (actor === undefined) throw new InvalidCredentialError('UNKNOWN_CREDENTIAL');
    return actor;
  }
}
