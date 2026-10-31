import type { SessionExtensionValues } from '@ddd-ts-kit/kernel';
import type { JWTPayload } from 'jose';
import { JwtAuthenticator } from './jwt-authenticator';
import { keycloakActorOf } from './keycloak-actor-of';
import { keycloakAuthenticationMethod } from './keycloak-authentication-method';
import type { KeycloakClaimOptions } from './keycloak-claim-options';
import { withoutTrailingSlashes } from './without-trailing-slashes';

export interface KeycloakAuthenticatorOptions extends KeycloakClaimOptions {
  /** Where Keycloak is served, without the realm: `https://id.example.com`. */
  readonly baseUrl: string;
  readonly realm: string;
  /** What the `aud` claim must name: this API, as the audience mapper of the realm writes it. */
  readonly audience: string | readonly string[];
  readonly algorithms?: readonly string[];
  readonly clockTolerance?: number;
  /** Default `true`: a token without `exp` is refused. See `requireExpiry` of `JwtAuthenticator`. */
  readonly requireExpiry?: boolean;
  /** Default `act`. See the README for the session note of an administrator impersonating a user. */
  readonly impersonatorClaim?: string;
  readonly toSessionExtensions?: (claims: JWTPayload) => SessionExtensionValues;
}

/**
 * A `JwtAuthenticator` for the access tokens of a Keycloak realm: issuer and key set derived
 * from the realm, realm roles and the roles of `clientId` as `roles`, `preferred_username`,
 * `email` and `groups` as attributes, `sid` as session id. Any other token of the realm, an ID
 * token whatever its audience, is refused.
 */
export function keycloakAuthenticator(options: KeycloakAuthenticatorOptions): JwtAuthenticator {
  const {
    baseUrl,
    realm,
    audience,
    algorithms,
    clockTolerance,
    requireExpiry,
    impersonatorClaim,
    toSessionExtensions,
  } = options;

  const issuer = `${withoutTrailingSlashes(baseUrl)}/realms/${encodeURIComponent(realm)}`;

  return new JwtAuthenticator({
    issuer,
    audience,
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    toActor: (claims) => keycloakActorOf(claims, options),
    authenticationMethod: keycloakAuthenticationMethod,
    ...(algorithms === undefined ? {} : { algorithms }),
    ...(clockTolerance === undefined ? {} : { clockTolerance }),
    ...(requireExpiry === undefined ? {} : { requireExpiry }),
    ...(impersonatorClaim === undefined ? {} : { impersonatorClaim }),
    ...(toSessionExtensions === undefined ? {} : { toSessionExtensions }),
  });
}
