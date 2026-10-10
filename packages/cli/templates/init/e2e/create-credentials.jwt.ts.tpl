import type { Authenticator } from '@ddd-ts-kit/auth';
import { JwtAuthenticator } from '@ddd-ts-kit/auth/jwt';
import type { HttpHeaders } from '@ddd-ts-kit/testing/e2e';
import { SignJWT, generateKeyPair, type CryptoKey } from 'jose';
import { authEnvironment } from './auth-environment.js';

const issuer = authEnvironment.AUTH_ISSUER;
const audience = authEnvironment.AUTH_AUDIENCE;

/** Who a test calls as: the subject, the roles and the tenant its token carries. */
export interface TestActor {
  readonly id: string;
  readonly roles?: readonly string[];
  readonly tenantId?: string;
}

export interface Credentials {
  /** The real verifier, on a key pair made for this run: tokens are signed here, verified by the application. */
  readonly authenticator: Authenticator;

  headersOf(actor: TestActor): Promise<HttpHeaders>;
}

export async function createCredentials(): Promise<Credentials> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');

  return {
    authenticator: new JwtAuthenticator({ issuer, audience, key: publicKey }),
    headersOf: async (actor) => ({ authorization: 'Bearer ' + (await tokenOf(actor, privateKey)) }),
  };
}

function tokenOf(actor: TestActor, key: CryptoKey): Promise<string> {
  const claims = { roles: actor.roles ?? [], ...(actor.tenantId === undefined ? {} : { tenant_id: actor.tenantId }) };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(actor.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}
