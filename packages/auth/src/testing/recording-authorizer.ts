import type { AccessScope } from '../authorization/access-scope';
import type { Authorizer } from '../authorization/authorizer';
import type { CheckRequest } from '../authorization/check-request';
import type { Decision } from '../authorization/decision';
import type { ListRequest } from '../authorization/list-request';
import { AllowAll } from './allow-all';

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
