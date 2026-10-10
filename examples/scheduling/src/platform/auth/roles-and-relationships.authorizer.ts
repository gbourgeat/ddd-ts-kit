import { ALLOWED, DenialReason, deny, type AccessScope, type Authorizer, type CheckRequest, type Decision, type ListRequest } from '@ddd-ts-kit/auth';
import { isAnonymous, isSystem, type Actor } from '@ddd-ts-kit/kernel';
import type { RoleGrant } from './role-grant.js';

/** What decides when no role does: it must be able to enumerate. */
type Relationships = Required<Pick<Authorizer, 'check' | 'listAccessible'>>;

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
    if (isAnonymous(request.actor)) return deny(DenialReason.anonymous);

    if (operatesItsOwnContext(request) || this.grantedByRole(request)) return ALLOWED;

    const decision = await this.relationships.check(request);

    return decision.allowed || !this.onlyARoleCouldGrant(request, decision.reason) ? decision : deny(DenialReason.noMatchingRole);
  }

  /** Only an unconditional grant that says `all` answers a list; any other opens the use case and leaves the scope to the relationships. */
  async listAccessible(request: ListRequest): Promise<AccessScope> {
    if (isAnonymous(request.actor)) return { kind: 'none' };

    const everything = this.grantsOf(request).some((grant) => grant.listing === 'all' && grant.when === undefined);

    return everything ? { kind: 'all' } : this.relationships.listAccessible(request);
  }

  private grantedByRole(request: CheckRequest): boolean {
    const facts = request.context ?? {};

    return this.grantsOf(request).some((grant) => grant.when === undefined || grant.when(facts));
  }

  /** The grants about this permission that this actor holds, conditions not yet asked. */
  private grantsOf({ actor, permission }: Pick<CheckRequest, 'actor' | 'permission'>): readonly RoleGrant[] {
    if (isSystem(actor)) return [];

    return this.grants.filter((grant) => grant.permissions.includes(permission.id) && holds(actor, grant));
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
  if (!isSystem(actor) || resource?.type !== 'context') return false;

  return permission.context === resource.id && actor.id.startsWith('system:' + resource.id + '.');
}

function holds(actor: Actor, grant: RoleGrant): boolean {
  return grant.role === undefined ? actor.type === 'user' : actor.roles.includes(grant.role);
}
