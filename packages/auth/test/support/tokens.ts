import { SignJWT, generateKeyPair, type CryptoKey, type JWTPayload } from 'jose';
import { JwtAuthenticator } from '../../src/jwt.js';

export const ISSUER = 'https://id.example.test/realms/shop';
export const AUDIENCE = 'shop-api';

const pair = await generateKeyPair('RS256');

export const signing: CryptoKey = pair.privateKey;
export const verifying: CryptoKey = pair.publicKey;
export const foreign: CryptoKey = (await generateKeyPair('RS256')).privateKey;

interface TokenOptions {
  readonly key?: CryptoKey;
  readonly issuer?: string;
  readonly audience?: string;
  readonly expiresIn?: string | number;
  readonly issuedAt?: number;
  readonly notBefore?: string;
}

/** A token of ada, signed by the key the authenticator trusts unless told otherwise. */
export function token(claims: JWTPayload, options: TokenOptions = {}): Promise<string> {
  const jwt = new SignJWT({ sub: 'ada', ...claims })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt(options.issuedAt)
    .setExpirationTime(options.expiresIn ?? '5m');

  if (options.notBefore !== undefined) {
    jwt.setNotBefore(options.notBefore);
  }

  return jwt.sign(options.key ?? signing);
}

export function authenticator(): JwtAuthenticator {
  return new JwtAuthenticator({ key: verifying, issuer: ISSUER, audience: AUDIENCE });
}

export async function refusalOf(credential: string, subject = authenticator()): Promise<unknown> {
  return subject.authenticate(credential).catch((error: unknown) => error);
}
