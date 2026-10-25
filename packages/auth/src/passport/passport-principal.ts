import { anonymousSession, type Session } from '@ddd-ts-kit/kernel';
import { sessionOf } from '../authentication/session-of';
import { InvalidCredentialError } from '../errors/invalid-credential-error';
import type { PassportPrincipalOptions } from './passport-principal-options';
import type { PassportStrategyLike } from './passport-strategy-like';
import { runStrategy } from './run-strategy';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The `resolvePrincipal` option of @ddd-ts-kit/http, from a strategy of Passport: the strategy
 * authenticates the request at the boundary, and the pipeline of the kit, its guards and the
 * permissions of the use cases decide what the caller may do, as with any authenticator. It fails
 * closed: a credential the strategy refuses is a 401, an error of the strategy or a strategy that
 * redirects (a sign-in flow, not the authentication of a call) refuses the request, and only a
 * request without credential, or one the strategy passes, goes on anonymous.
 *
 * Takes the strategy, or a function that answers it when the container that builds it, Nest's,
 * has started.
 */
export function passportPrincipal(
  strategy: PassportStrategyLike | (() => PassportStrategyLike),
  options: PassportPrincipalOptions,
): (raw: unknown) => Promise<Session> {
  const { actorOf, presented = hasAuthorization, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  return async (raw) => {
    const outcome = await runStrategy(typeof strategy === 'function' ? strategy() : strategy, raw, timeoutMs);

    switch (outcome.kind) {
      case 'success':
        return sessionOf(await actorOf(outcome.user, outcome.info));
      case 'fail':
        if (presented(raw)) {
          throw new InvalidCredentialError('refused-by-strategy');
        }

        return anonymousSession();
      case 'pass':
        return anonymousSession();
      case 'error':
        throw outcome.error;
      case 'redirect':
        throw new Error(
          'The strategy of Passport redirects: it is a sign-in flow, which the platform serves, not the authentication of a call.',
        );
    }
  };
}

function hasAuthorization(raw: unknown): boolean {
  const headers: unknown = typeof raw === 'object' && raw !== null ? Reflect.get(raw, 'headers') : undefined;

  const authorization: unknown =
    typeof headers === 'object' && headers !== null ? Reflect.get(headers, 'authorization') : undefined;

  return typeof authorization === 'string' && authorization.trim() !== '';
}
