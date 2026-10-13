import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Authenticator } from '@ddd-ts-kit/auth';
import { keycloakAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { HttpHeaders } from '@ddd-ts-kit/testing/e2e';
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey, type JWK } from 'jose';
import { IMPERSONATOR_CLAIM } from '@/platform/auth/create-authenticator';
import { authEnvironment } from '$test/e2e/support/auth-environment';

const realm = authEnvironment.KEYCLOAK_REALM;
const audience = authEnvironment.KEYCLOAK_AUDIENCE;
const keyId = 'e2e-key';

/** The network every actor of a spec belongs to unless it says otherwise: one of the `NETWORKS` of the test environment. */
export const NETWORK = 'north';

/** Who a test calls as: the subject, the realm roles and the network its token carries. */
export interface TestActor {
  readonly id: string;
  readonly roles?: readonly string[];
  /** The `tenant_id` claim: `NETWORK` when left out, none for `null` (platform staff). */
  readonly tenantId?: string | null;
  /** The support staff acting through this user: the session is then read-only. */
  readonly impersonatedBy?: string;
}

export interface Credentials {
  /** The real Keycloak verifier, on a key set served by this process: tokens are signed here with the claims a realm writes, verified by the application. */
  readonly authenticator: Authenticator;

  headersOf(actor: TestActor): Promise<HttpHeaders>;

  /** The bearer token of `actor`, without its scheme: what the typed client is given as the credential of `bearer`. */
  bearerOf(actor: TestActor): Promise<string>;
}

/** Stands for the realm: one key pair made for this run, published the way Keycloak publishes its own. */
export async function createCredentials(): Promise<Credentials> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const baseUrl = await serveKeySet({ ...(await exportJWK(publicKey)), kid: keyId, alg: 'RS256', use: 'sig' });

  const bearerOf = (actor: TestActor): Promise<string> =>
    tokenOf(actor, { key: privateKey, issuer: baseUrl + '/realms/' + realm });

  return {
    authenticator: keycloakAuthenticator({ baseUrl, realm, audience, impersonatorClaim: IMPERSONATOR_CLAIM }),
    headersOf: async (actor) => ({ authorization: 'Bearer ' + (await bearerOf(actor)) }),
    bearerOf,
  };
}

interface Signing {
  readonly key: CryptoKey;
  readonly issuer: string;
}

function tokenOf(actor: TestActor, { key, issuer }: Signing): Promise<string> {
  return new SignJWT(claimsOf(actor))
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setSubject(actor.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/** The claims a realm writes: its roles, its session, and the mappers this application asks for (tenant, impersonator). */
function claimsOf(actor: TestActor): Record<string, unknown> {
  return {
    realm_access: { roles: actor.roles ?? [] },
    preferred_username: actor.id,
    sid: 'session-of-' + actor.id,
    ...networkOf(actor),
    ...(actor.impersonatedBy === undefined ? {} : { [IMPERSONATOR_CLAIM]: actor.impersonatedBy }),
  };
}

/** The network the token names: the default one, another, or none for platform staff. */
function networkOf({ tenantId }: TestActor): Record<string, string> {
  if (tenantId === null) {
    return {};
  }

  return { tenant_id: tenantId ?? NETWORK };
}

/** The key set endpoint of a realm, on a free port of this machine. The server holds no reference: it ends with the test process. */
async function serveKeySet(key: JWK): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ keys: [key] }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();

  return 'http://127.0.0.1:' + boundPort(server);
}

function boundPort(server: Server): number {
  const address: AddressInfo | string | null = server.address();

  return typeof address === 'object' && address !== null ? address.port : 0;
}
