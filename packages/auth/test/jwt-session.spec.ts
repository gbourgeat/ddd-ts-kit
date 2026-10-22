import { describe, expect, it } from 'vitest';
import { anonymousSession } from '@ddd-ts-kit/kernel';
import type { JWTPayload } from 'jose';
import { JwtAuthenticator } from '../src/jwt';
import { AUDIENCE, ISSUER, authenticator, token, verifying } from './support/tokens';

declare module '@ddd-ts-kit/kernel' {
  interface SessionExtensions {
    readonly plan: 'free' | 'team';
  }
}

const ISSUED_AT = 1_772_359_200;

async function sessionOf(claims: JWTPayload, subject = authenticator()) {
  return subject.authenticateSession(await token(claims, { issuedAt: ISSUED_AT, expiresIn: 4_102_444_800 }));
}

describe('JwtAuthenticator session', () => {
  it('answers the anonymous session without credential', async () => {
    expect(await authenticator().authenticateSession(undefined)).toBe(anonymousSession());
  });

  it('reads the session of the token: id, instants, method, strength, locale and time zone', async () => {
    const session = await sessionOf({
      sid: 'session-42',
      jti: 'token-7',
      amr: ['pwd', 'otp', 'mfa'],
      acr: 'aal2',
      locale: 'fr-FR',
      zoneinfo: 'Europe/Paris',
      tenant_id: 'acme',
    });

    expect(session).toEqual({
      id: 'session-42',
      actor: { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} },
      issuedAt: new Date('2026-03-01T10:00:00.000Z'),
      expiresAt: new Date('2100-01-01T00:00:00.000Z'),
      authenticationMethod: 'password',
      authenticationStrength: { mfa: true, assuranceLevel: 'aal2' },
      locale: 'fr-FR',
      timeZone: 'Europe/Paris',
      extensions: {},
    });
  });

  it('reads the scopes the token grants, from scope or from scp, and none when it names none', async () => {
    expect((await sessionOf({ scope: 'invoices:read  invoices:write' })).scopes).toEqual([
      'invoices:read',
      'invoices:write',
    ]);

    expect((await sessionOf({ scp: ['invoices:read', 7, ''] })).scopes).toEqual(['invoices:read']);
    expect((await sessionOf({ scope: '' })).scopes).toBeUndefined();
    expect(await sessionOf({})).not.toHaveProperty('scopes');
  });

  it('keeps nothing of the token in the session', async () => {
    const credential = await token({ sid: 'session-42' });

    const session = await authenticator().authenticateSession(credential);

    expect(JSON.stringify(session)).not.toContain(credential);
  });

  it('answers the same actor as authenticate', async () => {
    const credential = await token({ roles: ['clerk'], tenant_id: 'acme' });

    expect((await authenticator().authenticateSession(credential)).actor).toEqual(
      await authenticator().authenticate(credential),
    );
  });

  it('identifies the session by the token id without sid, and by subject and issue instant without either', async () => {
    expect((await sessionOf({ jti: 'token-7' })).id).toBe('token-7');
    expect((await sessionOf({})).id).toBe('ada@1772359200000');
  });

  it('says a token is a token when nothing tells how the subject signed in', async () => {
    const session = await sessionOf({});

    expect(session.authenticationMethod).toBe('token');
    expect(session).not.toHaveProperty('authenticationStrength');
    expect(session).not.toHaveProperty('impersonatedBy');
    expect(session).not.toHaveProperty('locale');
  });

  it('reports a single factor as such, and an assurance level alone', async () => {
    expect((await sessionOf({ amr: ['pwd'] })).authenticationStrength).toEqual({ mfa: false });
    expect((await sessionOf({ acr: '1' })).authenticationStrength).toEqual({ assuranceLevel: '1' });
  });
});

describe('JwtAuthenticator session, as the project configures it', () => {
  it('lets the project say the method, as a value or from the claims', async () => {
    const fixed = new JwtAuthenticator({
      key: verifying,
      issuer: ISSUER,
      audience: AUDIENCE,
      authenticationMethod: 'sso',
    });

    const computed = new JwtAuthenticator({
      key: verifying,
      issuer: ISSUER,
      audience: AUDIENCE,
      authenticationMethod: (claims) => (claims['client_id'] === undefined ? 'sso' : 'service'),
    });

    expect((await sessionOf({}, fixed)).authenticationMethod).toBe('sso');
    expect((await sessionOf({ client_id: 'billing-worker' }, computed)).authenticationMethod).toBe('service');
  });

  it('reads who impersonates the subject from the actor claim of RFC 8693', async () => {
    expect((await sessionOf({ act: { sub: 'support-7' } })).impersonatedBy).toBe('support-7');
    expect((await sessionOf({ act: 'not-an-object' })).impersonatedBy).toBe('not-an-object');
    expect(await sessionOf({ act: { client: 'x' } })).not.toHaveProperty('impersonatedBy');
  });

  it('reads the impersonator from the claim it is told, as an id or as an object', async () => {
    const perNote = new JwtAuthenticator({
      key: verifying,
      issuer: ISSUER,
      audience: AUDIENCE,
      impersonatorClaim: 'impersonator',
    });

    expect((await sessionOf({ impersonator: 'support-7', act: { sub: 'ignored' } }, perNote)).impersonatedBy).toBe(
      'support-7',
    );

    expect((await sessionOf({ impersonator: { id: 'support-8', username: 'sam' } }, perNote)).impersonatedBy).toBe(
      'support-8',
    );
  });

  it('lets the project add its extensions from the claims', async () => {
    const withPlan = new JwtAuthenticator({
      key: verifying,
      issuer: ISSUER,
      audience: AUDIENCE,
      toSessionExtensions: (claims) => ({ plan: claims['plan'] === 'team' ? 'team' : 'free' }),
    });

    expect((await sessionOf({ plan: 'team' }, withPlan)).extensions).toEqual({ plan: 'team' });
  });

  it('refuses for a session what it refuses for an actor', async () => {
    const expired = await token({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 });

    await expect(authenticator().authenticateSession(expired)).rejects.toMatchObject({ reason: 'TOKEN_EXPIRED' });
  });
});
