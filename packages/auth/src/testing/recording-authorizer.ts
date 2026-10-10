import type { AccessScope } from '../authorization/access-scope.js';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import type { Decision } from '../authorization/decision.js';
import type { ListRequest } from '../authorization/list-request.js';
import { AllowAll } from './allow-all.js';

/** Keeps what it was asked, as data, and answers what the wrapped authorizer answers. */
export class RecordingAuthorizer implements Authorizer {
  readonly checks: CheckRequest[] = [];

  readonly listings: ListRequest[] = [];

  constructor(private readonly answering: Authorizer = new AllowAll()) {}

  async check(request: CheckRequest): Promise<Decision> {
    this.checks.push(request);

    return this.answering.check(request);
  }

  async listAccessible(request: ListRequest): Promise<AccessScope> {
    this.listings.push(request);

    return (await this.answering.listAccessible?.(request)) ?? { kind: 'none' };
  }
}
