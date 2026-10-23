import type { AccessScope } from '../authorization/access-scope';
import type { Authorizer } from '../authorization/authorizer';
import { deny, type Decision } from '../authorization/decision';

export class DenyAll implements Authorizer {
  constructor(private readonly reason = 'DENIED_BY_TEST') {}

  async check(): Promise<Decision> {
    return deny(this.reason);
  }

  async listAccessible(): Promise<AccessScope> {
    return { kind: 'none' };
  }
}
