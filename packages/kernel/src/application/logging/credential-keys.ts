/** The field names whose value a redacting logger never writes, at the top of an entry and one level below. */
export const CREDENTIAL_KEYS: readonly string[] = [
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'access_token',
  'refresh_token',
  'accessToken',
  'refreshToken',
  'client_secret',
];
