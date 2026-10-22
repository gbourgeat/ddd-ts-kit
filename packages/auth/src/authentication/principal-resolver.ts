import type { Session } from '@ddd-ts-kit/kernel';
import type { Authenticator } from './authenticator';
import { bearerCredential } from './bearer-credential';
import type { HeaderValues } from './header-values';
import { resolveSession } from './resolve-session';
import type { SessionAuthenticator } from './session-authenticator';

/**
 * The `resolvePrincipal` option of @ddd-ts-kit/http: takes the framework request, answers the
 * session. The pipeline puts it, with its actor, in the execution context of the request;
 * routes read `actorOf(context.principal)` and `sessionOf(context)`.
 */
export function principalResolver(
  authenticator: Authenticator | SessionAuthenticator,
): (raw: unknown) => Promise<Session> {
  return (raw) => resolveSession(authenticator, bearerCredential(headersOf(raw)));
}

function headersOf(raw: unknown): HeaderValues {
  if (typeof raw !== 'object' || raw === null || !('headers' in raw)) {
    return {};
  }

  const { headers } = raw;

  if (typeof headers !== 'object' || headers === null) {
    return {};
  }

  return Object.fromEntries(Object.entries(headers).filter(isHeader));
}

function isHeader(entry: [string, unknown]): entry is [string, string | readonly string[]] {
  const [, value] = entry;

  return typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}
