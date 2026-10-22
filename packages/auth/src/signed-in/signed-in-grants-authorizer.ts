import type { Actor } from '@ddd-ts-kit/kernel';
import type { AccessScope } from '../authorization/access-scope';
import type { Authorizer } from '../authorization/authorizer';
import type { CheckRequest } from '../authorization/check-request';
import { ALLOWED, type Decision } from '../authorization/decision';
import type { Explanation } from '../authorization/explanation';
import type { ListRequest } from '../authorization/list-request';
import { Trace } from '../authorization/trace';
import { ListingNotSupportedError } from '../errors/listing-not-supported-error';
import type { Grant } from '../permissions/grant';
import { grantCovers } from '../permissions/grant-covers';
import { grantPattern } from '../permissions/grant-pattern';
import type { Permission } from '../permissions/permission';

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
    if (this.coveringGrantOf(request.actor, request.permission) !== undefined) {
      return Promise.resolve(ALLOWED);
    }

    return this.options.otherwise.check(request);
  }

  /** Why: the grant of every signed-in person that covers the permission, or what the model said. */
  async explain(request: CheckRequest): Promise<Explanation> {
    const trace = new Trace();
    const { actor, permission } = request;
    const covering = this.coveringGrantOf(actor, permission);

    if (covering !== undefined) {
      trace.yes(
        `every signed-in person holds ${covering}${covering === permission.id ? '' : `, which covers ${permission.id}`}`,
      );

      return { decision: ALLOWED, trace: trace.lines };
    }

    if (actor.type === 'user') {
      trace.no(`no grant of every signed-in person covers ${permission.id}`);
    } else {
      trace.no(`the actor is a ${actor.type}, not a signed-in person`);
    }

    return { decision: await this.askTheModel(request, trace), trace: trace.lines };
  }

  listAccessible(request: ListRequest): Promise<AccessScope> {
    if (this.coveringGrantOf(request.actor, request.permission) !== undefined) {
      return Promise.resolve({ kind: 'all' });
    }

    if (this.options.otherwise.listAccessible === undefined) {
      return Promise.reject(new ListingNotSupportedError());
    }

    return this.options.otherwise.listAccessible(request);
  }

  private coveringGrantOf(actor: Actor, permission: Permission): string | undefined {
    return actor.type === 'user' ? this.patterns.find((pattern) => grantCovers(pattern, permission)) : undefined;
  }

  /** The lines of the model, one level deeper, when it explains itself; its decision alone otherwise. */
  private async askTheModel(request: CheckRequest, trace: Trace): Promise<Decision> {
    const { otherwise } = this.options;

    if (otherwise.explain !== undefined) {
      const { decision, trace: lines } = await otherwise.explain(request);

      trace.yes('the model decides');
      trace.include(lines);

      return decision;
    }

    const decision = await otherwise.check(request);

    if (decision.allowed) {
      trace.yes('the model allows');
    } else {
      trace.no(`the model refuses: ${decision.reason}`);
    }

    return decision;
  }
}
