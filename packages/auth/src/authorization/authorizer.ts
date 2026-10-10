import type { AccessScope } from './access-scope.js';
import type { CheckRequest } from './check-request.js';
import type { Decision } from './decision.js';
import type { ListRequest } from './list-request.js';

/**
 * The one port every authorization model implements: roles, attribute policies, relationships,
 * in process or delegated to a dedicated service. Handlers and middleware know nothing else.
 */
export abstract class Authorizer {
  static readonly tokenKey = 'auth.Authorizer';

  abstract check(request: CheckRequest): Promise<Decision>;

  /** Absent when the model cannot enumerate: asking for a scope then fails loudly. */
  abstract listAccessible?(request: ListRequest): Promise<AccessScope>;
}
