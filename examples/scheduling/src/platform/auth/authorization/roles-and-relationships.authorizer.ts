import {
  ALLOWED,
  DenialReason,
  deny,
  Trace,
  type AccessScope,
  type AuthorizationContext,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type Explanation,
  type ListRequest,
} from '@ddd-ts-kit/auth';
import { isAnonymous, isSystem, type Actor } from '@ddd-ts-kit/kernel';
import type { RoleGrant } from '@/platform/auth/authorization/role-grant';

/** What decides when no role does: it must be able to enumerate, and to explain itself. */
type Relationships = Required<Pick<Authorizer, 'check' | 'explain' | 'listAccessible'>>;

/**
 * Two models, one answer. The anonymous actor is refused; a system actor operates its own
 * bounded context; then a role of the token may grant the permission whatever the element;
 * else the relationships decide. A system actor never holds a role.
 */
export class RolesAndRelationshipsAuthorizer implements Authorizer {
  constructor(
    private readonly relationships: Relationships,
    private readonly grants: readonly RoleGrant[],
  ) {}

  async check(request: CheckRequest): Promise<Decision> {
    return (await this.explain(request)).decision;
  }

  /** Why: the context a system operates, the grant of the token that holds, else what the relationships said. */
  async explain(request: CheckRequest): Promise<Explanation> {
    const trace = new Trace();

    if (isAnonymous(request.actor)) {
      return { decision: deny(DenialReason.anonymous), trace: trace.lines };
    }

    if (operatesItsOwnContext(request)) {
      trace.yes(`the system operates its own context, ${request.permission.context}`);

      return { decision: ALLOWED, trace: trace.lines };
    }

    if (this.grantedByRole(request, trace)) {
      return { decision: ALLOWED, trace: trace.lines };
    }

    return { decision: await this.askTheRelationships(request, trace), trace: trace.lines };
  }

  /** Only an unconditional grant that says `all` answers a list; any other opens the use case and leaves the scope to the relationships. */
  async listAccessible(request: ListRequest): Promise<AccessScope> {
    if (isAnonymous(request.actor)) {
      return { kind: 'none' };
    }

    const everything = this.grantsOf(request).some((grant) => grant.listing === 'all' && grant.when === undefined);

    return everything ? { kind: 'all' } : this.relationships.listAccessible(request);
  }

  /** One line per grant of the token about this permission: a condition the use case states, or does not. */
  private grantedByRole(request: CheckRequest, trace: Trace): boolean {
    const facts = request.context ?? {};
    const grants = this.grantsOf(request);

    if (grants.length === 0) {
      return trace.no(
        isSystem(request.actor)
          ? 'a system actor holds no role'
          : `no role of the token grants ${request.permission.id}`,
      );
    }

    return grants.map((grant) => grantHolds(grant, facts, trace)).includes(true);
  }

  /** The grants about this permission that this actor holds, conditions not yet asked. */
  private grantsOf({ actor, permission }: Pick<CheckRequest, 'actor' | 'permission'>): readonly RoleGrant[] {
    if (isSystem(actor)) {
      return [];
    }

    return this.grants.filter((grant) => grant.permissions.includes(permission.id) && holds(actor, grant));
  }

  /** The lines of the relationships, one level deeper; a question they cannot bear on is answered by the missing role. */
  private async askTheRelationships(request: CheckRequest, trace: Trace): Promise<Decision> {
    const { decision, trace: lines } = await this.relationships.explain(request);

    trace.yes('the relationships decide');
    trace.include(lines);

    if (decision.allowed || !this.onlyARoleCouldGrant(request, decision.reason)) {
      return decision;
    }

    trace.no(`no relationship bears on ${request.permission.id}: a role is missing`, 1);

    return deny(DenialReason.noMatchingRole);
  }

  /** The relationships were asked a question that has no element or no meaning for them: the stable answer is the missing role. */
  private onlyARoleCouldGrant({ permission }: CheckRequest, reason: string): boolean {
    const outsideTheSchema = reason === DenialReason.resourceRequired || reason === DenialReason.unmappedPermission;

    return outsideTheSchema && this.grants.some((grant) => grant.permissions.includes(permission.id));
  }
}

/**
 * A system actor is named `<context>.<what it does>` by the code of its context (a scheduled
 * job, an integration event handler) and never comes from a token: it may use the permissions
 * of that context on that context, without a stored tuple. Anything else it asks goes to the relationships.
 */
function operatesItsOwnContext({ actor, permission, resource }: CheckRequest): boolean {
  if (!isSystem(actor) || resource?.type !== 'context') {
    return false;
  }

  return permission.context === resource.id && actor.id.startsWith('system:' + resource.id + '.');
}

function holds(actor: Actor, grant: RoleGrant): boolean {
  return grant.role === undefined ? actor.type === 'user' : actor.roles.includes(grant.role);
}

function grantHolds(grant: RoleGrant, facts: AuthorizationContext, trace: Trace): boolean {
  const holder = grant.role === undefined ? 'every signed-in user' : `the role ${grant.role}`;

  if (grant.when === undefined) {
    return trace.yes(`${holder} grants it`);
  }

  return grant.when(facts)
    ? trace.yes(`${holder} grants it under a condition the use case states`)
    : trace.no(`${holder} grants it under a condition the use case does not state`);
}
