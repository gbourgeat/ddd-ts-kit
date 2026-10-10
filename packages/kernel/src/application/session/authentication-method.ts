/** The standard methods come first; any other string names a method of the project. */
export type AuthenticationMethod =
  | 'none'
  | 'password'
  | 'sso'
  | 'token'
  | 'api-key'
  | 'service'
  | (string & Record<never, never>);
