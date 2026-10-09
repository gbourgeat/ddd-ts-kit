import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Authenticator } from '@ddd-ts-kit/auth';
import { keycloakAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { HttpHeaders } from '@ddd-ts-kit/testing/e2e';
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey, type JWK } from 'jose';

const REALM = 'e2e';
const AUDIENCE = 'e2e-api';
const KEY_ID = 'e2e-key';

/** What the configuration of the application needs to be valid in a test; the tests bring their own verifier. */
export const AUTH_ENVIRONMENT = { KEYCLOAK_URL: 'http://keycloak.e2e.test', KEYCLOAK_REALM: REALM, KEYCLOAK_AUDIENCE: AUDIENCE };

/** Who a test calls as: the subject, the realm roles and the tenant its token carries. */
export interface TestActor {
  readonly id: string;
  readonly roles?: readonly string[];
  readonly tenantId?: string;
}

export interface Credentials {
  /** The real Keycloak verifier, on a key set served by this process: tokens are signed here with the claims a realm writes, verified by the application. */
  readonly authenticator: Authenticator;
  headersOf(actor: TestActor): Promise<HttpHeaders>;
}

/** Stands for the realm: one key pair made for this run, published the way Keycloak publishes its own. */
export async function createCredentials(): Promise<Credentials> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const baseUrl = await serveKeySet({ ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' });
  return {
    authenticator: keycloakAuthenticator({ baseUrl, realm: REALM, audience: AUDIENCE }),
    headersOf: async (actor) => ({ authorization: 'Bearer ' + (await tokenOf(actor, { key: privateKey, issuer: baseUrl + '/realms/' + REALM })) }),
  };
}

interface Signing {
  readonly key: CryptoKey;
  readonly issuer: string;
}

function tokenOf(actor: TestActor, { key, issuer }: Signing): Promise<string> {
  const claims = { realm_access: { roles: actor.roles ?? [] }, preferred_username: actor.id, sid: 'session-of-' + actor.id, ...(actor.tenantId === undefined ? {} : { tenant_id: actor.tenantId }) };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setSubject(actor.id)
    .setIssuer(issuer)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
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
