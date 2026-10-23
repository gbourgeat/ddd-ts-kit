import { isRecord } from '../config/values/is-record';
import type { SchemeCarrier } from './scheme-carrier';

/**
 * How each security scheme carries its credential. An HTTP scheme is the `Authorization` header
 * with its scheme as the prefix (`Bearer`, `Basic`), OAuth 2 and OpenID Connect send a bearer
 * token, an API key goes where it says. A scheme of another kind is left out: no operation can send it.
 */
export function readSchemes(value: unknown): (readonly [string, SchemeCarrier])[] {
  const schemes = isRecord(value) ? value : {};

  return Object.entries(schemes).flatMap(([name, scheme]) => {
    const carrier = isRecord(scheme) ? carrierOf(scheme) : undefined;

    return carrier === undefined ? [] : [[name, carrier] as const];
  });
}

const AUTHORIZATION = 'Authorization';

function carrierOf(scheme: Record<string, unknown>): SchemeCarrier | undefined {
  const type = scheme['type'];

  if (type === 'http') {
    return { in: 'header', name: AUTHORIZATION, prefix: `${httpScheme(scheme['scheme'])} ` };
  }

  if (type === 'oauth2' || type === 'openIdConnect') {
    return { in: 'header', name: AUTHORIZATION, prefix: 'Bearer ' };
  }

  const where = scheme['in'];
  const name = scheme['name'];

  if (
    type !== 'apiKey' ||
    typeof name !== 'string' ||
    (where !== 'header' && where !== 'query' && where !== 'cookie')
  ) {
    return undefined;
  }

  return { in: where, name, prefix: '' };
}

/** `bearer` is written `Bearer` in the header, as every server expects it. */
function httpScheme(value: unknown): string {
  const scheme = typeof value === 'string' && value !== '' ? value : 'bearer';

  return scheme.charAt(0).toUpperCase() + scheme.slice(1).toLowerCase();
}
