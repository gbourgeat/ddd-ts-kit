import type { Authenticator } from '@ddd-ts-kit/auth';
import { passportAuthenticator } from '@ddd-ts-kit/auth/passport';
import type { HttpHeaders } from '@ddd-ts-kit/testing/e2e';
import { SignJWT, exportSPKI, generateKeyPair, type CryptoKey } from 'jose';
import { actorOfToken } from '{{alias.platform}}/auth/authentication/actor-of-token{{alias.ext}}';
import { bearerStrategy } from '{{alias.platform}}/auth/authentication/bearer-strategy{{alias.ext}}';
import { authEnvironment } from '{{alias.test}}/e2e/support/auth-environment{{alias.ext}}';

const issuer = authEnvironment.AUTH_ISSUER;
const audience = authEnvironment.AUTH_AUDIENCE;

/** Who a test calls as: the subject, the roles and the tenant its token carries. */
export interface TestActor {
  readonly id: string;
  readonly roles?: readonly string[];
  readonly tenantId?: string;
}

export interface Credentials {
  /** The strategy of the platform, on a key pair made for this run: tokens are signed here, verified by the application. */
  readonly authenticator: Authenticator;

  headersOf(actor: TestActor): Promise<HttpHeaders>;
}

export async function createCredentials(): Promise<Credentials> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const strategy = bearerStrategy({ issuer, audience, publicKey: await exportSPKI(publicKey) });

  return {
    authenticator: passportAuthenticator(strategy, { actorOf: actorOfToken }),
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
