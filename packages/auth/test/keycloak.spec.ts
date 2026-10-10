import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey, type JWTPayload } from 'jose';
import { InvalidCredentialError, principalResolver } from '../src/index.js';
import { keycloakAuthenticator, type KeycloakAuthenticatorOptions } from '../src/jwt.js';

const REALM = 'shop';
const AUDIENCE = 'shop-api';
const KEY_ID = 'realm-key-1';
const CERTS_PATH = `/realms/${REALM}/protocol/openid-connect/certs`;

let signing: CryptoKey;
let foreign: CryptoKey;
let keycloak: Server;
let baseUrl: string;
const requested: string[] = [];

/** Stands for the realm: serves its public keys where Keycloak does, and nothing else. */
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');

  signing = pair.privateKey;
  ({ privateKey: foreign } = await generateKeyPair('RS256'));

  const keys = JSON.stringify({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' }],
  });

  keycloak = createServer((request, response) => {
    requested.push(request.url ?? '');
    const found = request.url === CERTS_PATH;

    response.writeHead(found ? 200 : 404, { 'content-type': 'application/json' }).end(found ? keys : '{}');
  });

  await new Promise<void>((resolve) => keycloak.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(keycloak.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => keycloak.close(resolve));
});

/** The claims of an access token as Keycloak 26 issues it for a user signed in through a browser client. */
const userClaims = (): JWTPayload => ({
  exp: 4_102_444_800,
  iat: 1_772_359_200,
  auth_time: 1_772_359_100,
  jti: 'onrtac:5a1c7c0e-9f0b-4d37-8a55-0c6de1b3a001',
  iss: `${baseUrl}/realms/${REALM}`,
  aud: [AUDIENCE, 'account'],
  sub: 'f:1b2c3d4e:ada',
  typ: 'Bearer',
  azp: 'shop-web',
  sid: '7d9a2f6c-2a53-4c0e-9d57-6f0c1a2b3c4d',
  acr: '1',
  'allowed-origins': ['https://shop.example.test'],
  realm_access: { roles: ['offline_access', 'default-roles-shop', 'accountant'] },
  resource_access: {
    'shop-api': { roles: ['invoice-approver', 'accountant'] },
    account: { roles: ['manage-account', 'view-profile'] },
  },
  scope: 'openid profile email',
  email_verified: true,
  name: 'Ada Lovelace',
  groups: ['/finance', '/finance/europe'],
  preferred_username: 'ada',
  given_name: 'Ada',
  family_name: 'Lovelace',
  email: 'ada@example.test',
  locale: 'fr',
});

/** The claims of a token obtained with the client credentials grant: the service account of the client. */
const serviceAccountClaims = (): JWTPayload => ({
  exp: 4_102_444_800,
  iat: 1_772_359_200,
  jti: 'trrtcc:0d2b6c1e-6c0a-4a1b-b0b7-2c9f7a1d5e02',
  iss: `${baseUrl}/realms/${REALM}`,
  aud: AUDIENCE,
  sub: '9c3d0f52-aaaa-4bbb-8ccc-1234567890ab',
  typ: 'Bearer',
  azp: 'billing-worker',
  acr: '1',
  realm_access: { roles: ['default-roles-shop'] },
  resource_access: { 'shop-api': { roles: ['invoice-importer'] } },
  scope: 'profile email',
  client_id: 'billing-worker',
  preferred_username: 'service-account-billing-worker',
});

function signed(claims: JWTPayload, key: CryptoKey = signing): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: KEY_ID }).sign(key);
}

const authenticator = (options: Partial<KeycloakAuthenticatorOptions> = {}) =>
  keycloakAuthenticator({ baseUrl, realm: REALM, audience: AUDIENCE, ...options });

describe('keycloakAuthenticator', () => {
  it('finds the keys of the realm where Keycloak publishes them, whatever the trailing slash', async () => {
    requested.length = 0;

    await authenticator({ baseUrl: `${baseUrl}/` }).authenticate(await signed(userClaims()));

    expect(requested).toEqual([CERTS_PATH]);
  });

  it('turns the access token of a user into an actor with realm roles, name, email and groups', async () => {
    const actor = await authenticator().authenticate(await signed(userClaims()));

    expect(actor).toEqual({
      id: 'f:1b2c3d4e:ada',
      type: 'user',
      roles: ['offline_access', 'default-roles-shop', 'accountant'],
      attributes: { username: 'ada', email: 'ada@example.test', groups: ['/finance', '/finance/europe'] },
    });
  });

  it('adds the roles of the client it is told, once each, and of no other client', async () => {
    const actor = await authenticator({ clientId: 'shop-api' }).authenticate(await signed(userClaims()));

    expect(actor.roles).toEqual(['offline_access', 'default-roles-shop', 'accountant', 'invoice-approver']);
  });

  it('answers the session Keycloak opened: its sid, a single sign-on, the level of assurance, the locale', async () => {
    const session = await authenticator().authenticateSession(await signed(userClaims()));

    expect(session).toMatchObject({
      id: '7d9a2f6c-2a53-4c0e-9d57-6f0c1a2b3c4d',
      issuedAt: new Date('2026-03-01T10:00:00.000Z'),
      expiresAt: new Date('2100-01-01T00:00:00.000Z'),
      authenticationMethod: 'sso',
      authenticationStrength: { assuranceLevel: '1' },
      locale: 'fr',
      extensions: {},
    });
  });

  it('sees the service account of a client as a service, identified by its token', async () => {
    const session = await authenticator({ clientId: 'shop-api' }).authenticateSession(
      await signed(serviceAccountClaims()),
    );

    expect(session).toMatchObject({
      id: 'trrtcc:0d2b6c1e-6c0a-4a1b-b0b7-2c9f7a1d5e02',
      authenticationMethod: 'service',
      actor: {
        id: '9c3d0f52-aaaa-4bbb-8ccc-1234567890ab',
        type: 'service',
        roles: ['default-roles-shop', 'invoice-importer'],
        attributes: { username: 'service-account-billing-worker' },
      },
    });
  });

  it.each([
    ['a text claim', { tenant_id: 'acme' }, undefined, 'acme'],
    ['the organization claim as a list', { organization: ['acme'] }, 'organization', 'acme'],
    ['the organization claim as an object', { organization: { acme: { id: 'a1b2' } } }, 'organization', 'acme'],
    ['several organizations, which name no tenant', { organization: ['acme', 'globex'] }, 'organization', undefined],
    ['no organization', { organization: [] }, 'organization', undefined],
    ['a claim that is not text', { tenant_id: 42 }, undefined, undefined],
  ])('reads the tenant from %s', async (_case, claims, tenantClaim, tenantId) => {
    const subject = authenticator(tenantClaim === undefined ? {} : { tenantClaim });

    expect((await subject.authenticate(await signed({ ...userClaims(), ...claims }))).tenantId).toBe(tenantId);
  });

  it('reads the administrator impersonating the user from the session note mapped to a claim', async () => {
    const subject = authenticator({ impersonatorClaim: 'impersonator_id' });
    const credential = await signed({ ...userClaims(), impersonator_id: 'a7e0c1d2-support' });

    expect((await subject.authenticateSession(credential)).impersonatedBy).toBe('a7e0c1d2-support');
  });

  it('reads the groups from the claim the mapper writes, and none without the mapper', async () => {
    const { groups: _groups, ...withoutGroups } = userClaims();
    const renamed = authenticator({ groupsClaim: 'memberships' });

    expect((await authenticator().authenticate(await signed(withoutGroups))).attributes).toEqual({
      username: 'ada',
      email: 'ada@example.test',
    });

    expect(
      (await renamed.authenticate(await signed({ ...withoutGroups, memberships: ['/finance'] }))).attributes['groups'],
    ).toEqual(['/finance']);
  });
});

describe('keycloakAuthenticator at the boundary', () => {
  it('refuses a token Keycloak issued for the account console only, the default without an audience mapper', async () => {
    const refusal = await authenticator()
      .authenticate(await signed({ ...userClaims(), aud: 'account' }))
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(InvalidCredentialError);
    expect(refusal).toMatchObject({ reason: 'CLAIM_MISMATCH' });
  });

  it('refuses a token of another realm, and one signed by a key the realm does not publish', async () => {
    const otherRealm = { ...userClaims(), iss: `${baseUrl}/realms/other` };

    await expect(authenticator().authenticate(await signed(otherRealm))).rejects.toMatchObject({
      reason: 'CLAIM_MISMATCH',
    });

    await expect(authenticator().authenticate(await signed(userClaims(), foreign))).rejects.toMatchObject({
      reason: 'BAD_SIGNATURE',
    });
  });

  it('refuses a token without subject', async () => {
    const { sub: _sub, ...withoutSubject } = userClaims();

    await expect(authenticator().authenticate(await signed(withoutSubject))).rejects.toMatchObject({
      reason: 'NO_SUBJECT',
    });
  });

  it('plugs into the HTTP boundary as it is', async () => {
    const resolve = principalResolver(authenticator({ clientId: 'shop-api' }));

    const session = await resolve({ headers: { authorization: `Bearer ${await signed(userClaims())}` } });

    expect(session.actor.roles).toContain('invoice-approver');
    expect(session.id).toBe('7d9a2f6c-2a53-4c0e-9d57-6f0c1a2b3c4d');
  });
});
