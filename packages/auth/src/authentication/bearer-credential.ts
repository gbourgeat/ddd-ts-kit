import { InvalidCredentialError } from '../errors/invalid-credential-error.js';
import type { HeaderValues } from './header-values.js';

const BEARER = /^Bearer +([A-Za-z0-9._~+/-]+=*)$/i;

/**
 * The token of `Authorization: Bearer <token>`, or `undefined` without the header. A header
 * that is there and is not a well-formed bearer credential is refused, never ignored.
 */
export function bearerCredential(headers: HeaderValues): string | undefined {
  const name = Object.keys(headers).find((header) => header.toLowerCase() === 'authorization');
  const value = name === undefined ? undefined : headers[name];

  if (value === undefined) {
    return undefined;
  }

  const token = typeof value === 'string' ? BEARER.exec(value)?.[1] : undefined;

  if (token === undefined) {
    throw new InvalidCredentialError('MALFORMED_AUTHORIZATION_HEADER');
  }

  return token;
}
