import { anonymousActor } from '@ddd-ts-kit/kernel';
import type { Authenticator } from '../authentication/authenticator';
import { passportPrincipal } from './passport-principal';
import type { PassportPrincipalOptions } from './passport-principal-options';
import type { PassportStrategyLike } from './passport-strategy-like';

/**
 * An `Authenticator` whose bearer credential a strategy of Passport verifies: the strategy is run
 * on a request that carries the credential as `Authorization: Bearer <credential>`, as a client of
 * the contract sends it, so that every user of the port (the HTTP boundary, the procedures, the
 * end-to-end tests) authenticates through the strategy. No credential is the anonymous actor; one
 * the strategy fails is an `InvalidCredentialError`, as with `JwtAuthenticator`.
 */
export function passportAuthenticator(
  strategy: PassportStrategyLike | (() => PassportStrategyLike),
  options: Omit<PassportPrincipalOptions, 'presented'>,
): Authenticator {
  const resolve = passportPrincipal(strategy, options);

  return {
    authenticate: async (credential) => {
      if (credential === undefined || credential === '') {
        return anonymousActor();
      }

      return (await resolve({ headers: { authorization: `Bearer ${credential}` } })).actor;
    },
  };
}
