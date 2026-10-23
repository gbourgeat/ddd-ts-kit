import type { AccessScope } from '../authorization/access-scope';
import type { Authorizer } from '../authorization/authorizer';
import { ALLOWED, type Decision } from '../authorization/decision';

/** For the specs that are not about rights: everything is granted to everybody. */
export class AllowAll implements Authorizer {
  async check(): Promise<Decision> {
    return ALLOWED;
  }

  async listAccessible(): Promise<AccessScope> {
    return { kind: 'all' };
  }
}
