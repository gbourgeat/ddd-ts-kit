import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  anonymousSession,
  isAnonymous,
  isExpired,
  isImpersonated,
  isSystem,
  systemSession,
  type Actor,
  type Session,
} from '../src';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['author'], attributes: {} };
const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

function sessionOf(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    actor: ada,
    issuedAt: new Date('2026-03-01T09:00:00.000Z'),
    authenticationMethod: 'password',
    extensions: {},
    ...overrides,
  };
}

describe('Session', () => {
  it('is alive until the instant it expires at', () => {
    const session = sessionOf({ expiresAt: new Date('2026-03-01T10:00:01.000Z') });

    expect(isExpired(session, clock.now())).toBe(false);
    clock.advance(1000);
    expect(isExpired(session, clock.now())).toBe(true);
  });

  it('never expires without an expiry', () => {
    expect(isExpired(sessionOf(), new Date('2099-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('shows who is acting as the actor', () => {
    const impersonated = sessionOf({ impersonatedBy: 'support-7' });

    expect(isImpersonated(impersonated)).toBe(true);
    expect(isImpersonated(sessionOf())).toBe(false);
  });

  it('accepts a method of the project next to the standard ones', () => {
    expect(sessionOf({ authenticationMethod: 'passkey' }).authenticationMethod).toBe('passkey');
  });

  it('gives the caller without credential a session that cannot be altered', () => {
    const session = anonymousSession();

    expect(isAnonymous(session.actor)).toBe(true);
    expect(session).toMatchObject({ id: 'anonymous', authenticationMethod: 'none', extensions: {} });
    expect(Object.isFrozen(session)).toBe(true);
    expect(isExpired(session, clock.now())).toBe(false);
    expect(anonymousSession()).toBe(session);
  });

  it('gives the system a session named after what runs', () => {
    const session = systemSession('invoice-reminder', clock.now());

    expect(isSystem(session.actor)).toBe(true);

    expect(session).toMatchObject({
      id: 'system:invoice-reminder',
      authenticationMethod: 'service',
      issuedAt: clock.now(),
    });

    expect(Object.isFrozen(session)).toBe(true);
  });
});
