/**
 * The field names whose value a redacting logger never writes, at the top of an entry and one
 * level below. `isCredentialKey` compares them without case: `Authorization` is `authorization`.
 */
export const CREDENTIAL_KEYS: readonly string[] = [
  'password',
  'passwd',
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'x-api-key',
  'access_token',
  'refresh_token',
  'id_token',
  'accessToken',
  'refreshToken',
  'idToken',
  'client_secret',
  'clientSecret',
  'client-secret',
  'private_key',
  'privateKey',
];
