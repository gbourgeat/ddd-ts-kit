/** The standard categories come first; any other string names a category of the project. */
export type AuditCategory =
  | 'authorization'
  | 'command'
  | 'query'
  | 'integration-event'
  | 'authentication'
  | 'data-access'
  | (string & Record<never, never>);
