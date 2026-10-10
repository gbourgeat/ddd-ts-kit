import type { AccessScope } from '../authorization/access-scope.js';
import type { Authorizer } from '../authorization/authorizer.js';
import { deny, type Decision } from '../authorization/decision.js';

export class DenyAll implements Authorizer {
  constructor(private readonly reason = 'DENIED_BY_TEST') {}

  async check(): Promise<Decision> {
    return deny(this.reason);
  }

  async listAccessible(): Promise<AccessScope> {
    return { kind: 'none' };
  }
}
