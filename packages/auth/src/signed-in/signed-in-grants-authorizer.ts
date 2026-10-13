import type { Actor } from '@ddd-ts-kit/kernel';
import type { AccessScope } from '../authorization/access-scope.js';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import { ALLOWED, type Decision } from '../authorization/decision.js';
import type { ListRequest } from '../authorization/list-request.js';
import { ListingNotSupportedError } from '../errors/listing-not-supported-error.js';
import type { Grant } from '../permissions/grant.js';
import { grantCovers } from '../permissions/grant-covers.js';
import { grantPattern } from '../permissions/grant-pattern.js';
import type { Permission } from '../permissions/permission.js';

export interface SignedInGrantsAuthorizerOptions {
  /** What every signed-in person may do, whatever their roles, attributes or relationships. */
  readonly grants: readonly Grant[];
  /** The model of the project, which decides everything else. */
  readonly otherwise: Authorizer;
}

/**
 * Grants every person who signed in (an actor of type `user`) the same permissions, then lets
 * the model of the project decide the rest: what a context gives everyone, such as managing
 * one's own account, before its policies decide on the element. Systems, services and anonymous
 * actors get nothing from it.
 */
export class SignedInGrantsAuthorizer implements Authorizer {
  private readonly patterns: readonly string[];

  constructor(private readonly options: SignedInGrantsAuthorizerOptions) {
    this.patterns = options.grants.map(grantPattern);
  }

  check(request: CheckRequest): Promise<Decision> {
    if (this.grants(request.actor, request.permission)) {
      return Promise.resolve(ALLOWED);
    }

    return this.options.otherwise.check(request);
  }

  listAccessible(request: ListRequest): Promise<AccessScope> {
    if (this.grants(request.actor, request.permission)) {
      return Promise.resolve({ kind: 'all' });
    }

    if (this.options.otherwise.listAccessible === undefined) {
      return Promise.reject(new ListingNotSupportedError());
    }

    return this.options.otherwise.listAccessible(request);
  }

  private grants(actor: Actor, permission: Permission): boolean {
    return actor.type === 'user' && this.patterns.some((pattern) => grantCovers(pattern, permission));
  }
}
