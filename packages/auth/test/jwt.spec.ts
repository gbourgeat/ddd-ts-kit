import { beforeAll, describe, expect, it } from 'vitest';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { SignJWT, UnsecuredJWT, exportJWK, generateKeyPair, type CryptoKey, type JWTPayload } from 'jose';
import { InvalidCredentialError } from '../src/index.js';
import { JwtAuthenticator } from '../src/jwt.js';

const ISSUER = 'https://id.example.test/realms/shop';
const AUDIENCE = 'shop-api';

let signing: CryptoKey;
let verifying: CryptoKey;
let foreign: CryptoKey;

beforeAll(async () => {
  ({ privateKey: signing, publicKey: verifying } = await generateKeyPair('RS256'));
  ({ privateKey: foreign } = await generateKeyPair('RS256'));
});

interface TokenOptions {
  readonly key?: CryptoKey;
  readonly issuer?: string;
  readonly audience?: string;
  readonly expiresIn?: string | number;
  readonly notBefore?: string;
}

function token(claims: JWTPayload, options: TokenOptions = {}): Promise<string> {
  const jwt = new SignJWT({ sub: 'ada', ...claims })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m');
  if (options.notBefore !== undefined) jwt.setNotBefore(options.notBefore);
  return jwt.sign(options.key ?? signing);
}

const authenticator = () => new JwtAuthenticator({ key: verifying, issuer: ISSUER, audience: AUDIENCE });

async function refusalOf(credential: string, subject = authenticator()): Promise<unknown> {
  return subject.authenticate(credential).catch((error: unknown) => error);
}

describe('JwtAuthenticator', () => {
  it('answers the anonymous actor without credential', async () => {
    expect(await authenticator().authenticate(undefined)).toEqual(anonymousActor());
  });

  it('turns a valid token into an actor that keeps nothing of the token', async () => {
    const credential = await token({ realm_access: { roles: ['accountant', 'clerk'] }, tenant_id: 'acme', email: 'ada@example.test' });

    const actor = await authenticator().authenticate(credential);

    expect(actor).toEqual({ id: 'ada', type: 'user', tenantId: 'acme', roles: ['accountant', 'clerk'], attributes: {} });
    expect(JSON.stringify(actor)).not.toContain(credential);
  });

  it('refuses an expired token', async () => {
    const refusal = await refusalOf(await token({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 }));

    expect(refusal).toBeInstanceOf(InvalidCredentialError);
    expect(refusal).toMatchObject({ code: 'UNAUTHORIZED', reason: 'TOKEN_EXPIRED' });
  });

  it('tolerates the clock difference it was told to', async () => {
    const justExpired = await token({}, { expiresIn: Math.floor(Date.now() / 1000) - 5 });
    const tolerant = new JwtAuthenticator({ key: verifying, issuer: ISSUER, audience: AUDIENCE, clockTolerance: 60 });

    expect((await tolerant.authenticate(justExpired)).id).toBe('ada');
  });

  it('refuses a token that is not valid yet', async () => {
    expect(await refusalOf(await token({}, { notBefore: '10m' }))).toMatchObject({ reason: 'CLAIM_MISMATCH' });
  });

  it('refuses a token meant for another audience', async () => {
    expect(await refusalOf(await token({}, { audience: 'another-api' }))).toMatchObject({
      code: 'UNAUTHORIZED',
      reason: 'CLAIM_MISMATCH',
    });
  });

  it('refuses a token of another issuer', async () => {
    expect(await refusalOf(await token({}, { issuer: 'https://evil.example.test' }))).toMatchObject({
      code: 'UNAUTHORIZED',
      reason: 'CLAIM_MISMATCH',
    });
  });

  it('refuses a token signed with another key', async () => {
    expect(await refusalOf(await token({}, { key: foreign }))).toMatchObject({
      code: 'UNAUTHORIZED',
      reason: 'BAD_SIGNATURE',
    });
  });

  it('refuses a token altered after it was signed', async () => {
    const [header = '', , signature = ''] = (await token({ roles: ['clerk'] })).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'ada', iss: ISSUER, aud: AUDIENCE, roles: ['admin'] })).toString('base64url');

    expect(await refusalOf(`${header}.${forged}.${signature}`)).toMatchObject({ reason: 'BAD_SIGNATURE' });
  });

  it('refuses an unsigned token, alg none', async () => {
    const unsigned = new UnsecuredJWT({ sub: 'ada', roles: ['admin'] })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .encode();

    const refusal = await refusalOf(unsigned);

    expect(refusal).toBeInstanceOf(InvalidCredentialError);
    expect(refusal).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('refuses an algorithm outside the allow-list, such as a shared secret passed off as a key', async () => {
    const secret = new TextEncoder().encode('a-shared-secret-of-at-least-32-bytes!');
    const symmetric = await new SignJWT({ sub: 'ada' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(secret);

    expect(await refusalOf(symmetric)).toMatchObject({ reason: 'ALGORITHM_NOT_ALLOWED' });
    expect(
      await new JwtAuthenticator({ key: secret, issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] }).authenticate(symmetric),
    ).toMatchObject({ id: 'ada' });
  });

  it.each(['', 'not-a-token', 'a.b.c'])('refuses the malformed credential %j', async (credential) => {
    expect(await refusalOf(credential)).toMatchObject({ code: 'UNAUTHORIZED', reason: 'MALFORMED_TOKEN' });
  });

  it('refuses a token without subject', async () => {
    const anonymous = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(signing);

    expect(await refusalOf(anonymous)).toMatchObject({ reason: 'NO_SUBJECT' });
  });

  it('accepts a key given as a JWK', async () => {
    const jwk = await exportJWK(verifying);
    const fromJwk = new JwtAuthenticator({ key: { ...jwk, alg: 'RS256' }, issuer: ISSUER, audience: AUDIENCE });

    expect((await fromJwk.authenticate(await token({}))).id).toBe('ada');
  });
});

describe('JwtAuthenticator default claim mapping', () => {
  const rolesOf = async (claims: JWTPayload) => (await authenticator().authenticate(await token(claims))).roles;

  it('reads the realm roles first', async () => {
    expect(await rolesOf({ realm_access: { roles: ['accountant'] }, roles: ['clerk'], scope: 'openid' })).toEqual(['accountant']);
  });

  it('reads a roles claim otherwise, as a list or as words', async () => {
    expect(await rolesOf({ roles: ['clerk', 'auditor'], scope: 'openid' })).toEqual(['clerk', 'auditor']);
    expect(await rolesOf({ roles: 'clerk auditor' })).toEqual(['clerk', 'auditor']);
  });

  it('falls back on the scopes, and never mixes them with roles', async () => {
    expect(await rolesOf({ scope: 'openid invoices:read' })).toEqual(['openid', 'invoices:read']);
    expect(await rolesOf({ roles: [], scope: 'admin' })).toEqual([]);
  });

  it('gives no role without any of these claims, and ignores what is not text', async () => {
    expect(await rolesOf({})).toEqual([]);
    expect(await rolesOf({ roles: ['clerk', 42, null] })).toEqual(['clerk']);
  });

  it('reads the tenant from the claim it is told', async () => {
    const perOrganization = new JwtAuthenticator({ key: verifying, issuer: ISSUER, audience: AUDIENCE, tenantClaim: 'org' });
    const credential = await token({ org: 'globex', tenant_id: 'acme' });

    expect((await perOrganization.authenticate(credential)).tenantId).toBe('globex');
    expect((await authenticator().authenticate(await token({ tenant_id: 42 }))).tenantId).toBeUndefined();
  });

  it('lets the project map the claims itself', async () => {
    const custom = new JwtAuthenticator({
      key: verifying,
      issuer: ISSUER,
      audience: AUDIENCE,
      toActor: (claims) => ({
        id: `client-${claims.sub ?? ''}`,
        type: 'service',
        roles: ['integration'],
        attributes: { region: String(claims['region']) },
      }),
    });

    expect(await custom.authenticate(await token({ region: 'eu' }))).toEqual({
      id: 'client-ada',
      type: 'service',
      roles: ['integration'],
      attributes: { region: 'eu' },
    });
  });
});

describe('JwtAuthenticator with a remote key set', () => {
  it('leaves an unreachable key set an infrastructure fault, not a refusal', async () => {
    const remote = new JwtAuthenticator({ jwksUri: 'http://127.0.0.1:9/jwks', issuer: ISSUER, audience: AUDIENCE });

    const failure = await refusalOf(await token({}), remote);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(InvalidCredentialError);
  });
});
