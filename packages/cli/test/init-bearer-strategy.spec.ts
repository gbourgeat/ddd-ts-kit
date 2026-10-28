import { generateKeyPairSync, sign } from 'node:crypto';
import { DEFAULT_JWT_ALGORITHMS, InvalidCredentialError, actorOfClaims, type Authenticator } from '@ddd-ts-kit/auth';
import { passportAuthenticator, type PassportStrategyLike } from '@ddd-ts-kit/auth/passport';
import { beforeAll, describe, expect, it } from 'vitest';
import { read } from './helpers';
import { importGenerated } from './support/import-generated';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const STRATEGY = 'src/platform/auth/authentication/bearer-strategy.ts';
const ISSUER = 'https://issuer.test';
const AUDIENCE = 'api';

interface BearerTokens {
  readonly issuer: string;
  readonly audience: string;
  readonly publicKey: string;
  readonly requireExpiry?: boolean;
}

type BearerStrategy = (tokens: BearerTokens) => PassportStrategyLike;

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

/** A token signed RS256 by the key the strategy trusts, with the claims given and nothing else. */
function tokenOf(claims: Record<string, unknown>): string {
  const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signed = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: ISSUER, aud: AUDIENCE, ...claims })}`;

  return `${signed}.${sign('sha256', Buffer.from(signed), privateKey).toString('base64url')}`;
}

describe('init --authn passport, the strategy that verifies a bearer token', () => {
  let root = '';
  let bearerStrategy: BearerStrategy;

  const authenticatorOf = (requireExpiry?: boolean): Authenticator => {
    const key = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const tokens = { issuer: ISSUER, audience: AUDIENCE, publicKey: key };
    const strategy = bearerStrategy(requireExpiry === undefined ? tokens : { ...tokens, requireExpiry });

    return passportAuthenticator(strategy, { actorOf: (user) => actorOfClaims({ ...Object(user) }) });
  };

  beforeAll(async () => {
    root = initProject('--http', 'nest', '--authn', 'passport');

    const generated = await importGenerated(root, STRATEGY, [
      { name: 'passport-jwt', from: 'auth' },
      { name: 'jwks-rsa', from: 'auth' },
    ]);

    bearerStrategy = jsonAt(generated, 'bearerStrategy') as BearerStrategy;
  });

  it('the strategy allows the algorithms the authenticator allows, but EdDSA, which jsonwebtoken cannot verify', () => {
    const written = /const ALGORITHMS = \[([^\]]*)\] as const;/.exec(read(root, STRATEGY))?.[1] ?? '';

    const allowed = [...written.matchAll(/'([^']+)'/g)].map(([, algorithm]) => algorithm);

    expect(allowed).toEqual(DEFAULT_JWT_ALGORITHMS.filter((algorithm) => algorithm !== 'EdDSA'));
  });

  it('a token without exp is refused for its missing expiry, while the same token with exp is accepted', async () => {
    const endless = tokenOf({ sub: 'ada' });
    const expiring = tokenOf({ sub: 'ada', exp: Math.floor(Date.now() / 1000) + 300 });

    const refusal = await authenticatorOf()
      .authenticate(endless)
      .catch((error: unknown) => error);

    const actor = await authenticatorOf().authenticate(expiring);

    expect(refusal).toBeInstanceOf(InvalidCredentialError);
    expect(refusal).toMatchObject({ reason: 'NO_EXPIRY' });
    expect(actor.id).toBe('ada');
  });

  it('a token without exp is accepted when the expiry is not required, a conscious choice', async () => {
    const credential = tokenOf({ sub: 'ada' });

    const actor = await authenticatorOf(false).authenticate(credential);

    expect(actor.id).toBe('ada');
  });
});
