/**
 * Where the administration API of the identity provider is, and the client it is called as: the
 * settings of `KeycloakIdentityProviderAdmin`. The default adapter reads them from the
 * environment when a call is made; the platform may bind a value of its validated config instead.
 */
export abstract class IdentityProviderConnection {
  /** `baseUrl` of the provider, its realm, and a confidential client allowed to manage users and organisations. */
  abstract settings(): Promise<{
    readonly baseUrl: string;
    readonly realm: string;
    readonly clientId: string;
    readonly clientSecret: string;
  }>;
}
