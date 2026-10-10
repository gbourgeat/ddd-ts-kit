import type { AccessScope } from '../authorization/access-scope.js';
import type { Authorizer } from '../authorization/authorizer.js';
import { ALLOWED, type Decision } from '../authorization/decision.js';

/** For the specs that are not about rights: everything is granted to everybody. */
export class AllowAll implements Authorizer {
  async check(): Promise<Decision> {
    return ALLOWED;
  }

  async listAccessible(): Promise<AccessScope> {
    return { kind: 'all' };
  }
}
