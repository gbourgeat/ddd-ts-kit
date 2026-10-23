import { isAnonymous, isSystem, isTenantId, isTenantMember, tenantsOf, type Actor } from '@ddd-ts-kit/kernel';
import type { AccessScope } from '../authorization/access-scope.js';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import { ALLOWED, deny, type Decision } from '../authorization/decision.js';
import { DenialReason } from '../authorization/denial-reason.js';
import type { Explanation } from '../authorization/explanation.js';
import type { ListRequest } from '../authorization/list-request.js';
import { Trace } from '../authorization/trace.js';
import { AuthorizationSetupError } from '../errors/authorization-setup-error.js';
import type { Permission } from '../permissions/permission.js';
import { RoleGrants, type CoveringGrant, type RoleGrantsDefinition } from './role-grants.js';
import { tenantCheck, type TenantOf } from './tenant-check.js';

export interface RoleBasedAuthorizerOptions extends RoleGrantsDefinition {
  /**
   * Turns the tenant check on: the tenant the request targets, or `undefined` when it targets
   * none. A request about a tenant the actor does not belong to (its `tenantId` or its `tenants`),
   * or about another tenant than the one the work runs in, is refused. See `tenantOfContext`.
   */
  readonly tenantOf?: TenantOf;
  /** Roles that act across tenants, such as a platform operator. Requires `tenantOf`. */
  readonly crossTenantRoles?: readonly string[];
  /**
   * The role given to actors of type `system`, which carry none. Default: no role. Under
   * `tenantOf`, a system actor belongs to the tenant its work runs in (a per-tenant job, an event
   * of a tenant), and to none outside of one.
   */
  readonly systemRole?: string;
}

/** RBAC: an actor may do what one of its roles grants. It decides on actions, not on elements. */
export class RoleBasedAuthorizer implements Authorizer {
  private readonly grants: RoleGrants;

  constructor(private readonly options: RoleBasedAuthorizerOptions) {
    this.grants = new RoleGrants(options);
    assertTenancyOptions(options, this.grants);
  }

  async check(request: CheckRequest): Promise<Decision> {
    return (await this.explain(request)).decision;
  }

  /** Why: what each role of the actor grants and, when tenants are checked, where the request may act. */
  async explain(request: CheckRequest): Promise<Explanation> {
    const trace = new Trace();

    if (isAnonymous(request.actor)) {
      return { decision: deny(DenialReason.anonymous), trace: trace.lines };
    }

    if (!this.someRoleGrants(request.actor, request.permission, trace)) {
      return { decision: deny(DenialReason.noMatchingRole), trace: trace.lines };
    }

    const inTenant = await this.staysInATenantOfTheActor(request, trace);

    return { decision: inTenant ? ALLOWED : deny(DenialReason.tenantMismatch), trace: trace.lines };
  }

  /**
   * Constant time: everything, nothing, or the rows of one tenant: the tenant of the work when the
   * actor belongs to it, else the one tenant of an actor that has one. An actor of several tenants
   * outside of a tenant's work reads nothing: a filter names one tenant.
   */
  async listAccessible(request: ListRequest): Promise<AccessScope> {
    const { actor, permission } = request;

    if (isAnonymous(actor) || !this.holds(actor, permission)) {
      return { kind: 'none' };
    }

    if (this.options.tenantOf === undefined || this.crossingRoleOf(actor) !== undefined) {
      return { kind: 'all' };
    }

    const tenantId = listedTenantOf(request);

    return tenantId === undefined ? { kind: 'none' } : { kind: 'filter', filter: { tenantId } };
  }

  /** Every role of the actor is visited, one line each, so a refusal says what each one grants. */
  private someRoleGrants(actor: Actor, permission: Permission, trace: Trace): boolean {
    const roles = this.rolesOf(actor);

    if (roles.length === 0) {
      return trace.no(`${permission.id} asked of no role: the ${isSystem(actor) ? 'system' : 'actor'} holds none`);
    }

    trace.yes(`${permission.id} asked of the roles ${roles.join(', ')}${this.systemRoleNote(actor)}`);

    let granted = false;

    for (const role of roles) {
      granted = this.roleGrants(role, permission, trace) || granted;
    }

    return granted;
  }

  private roleGrants(role: string, permission: Permission, trace: Trace): boolean {
    if (!this.grants.declares(role)) {
      return trace.no(`${role} is not a declared role`, 1);
    }

    const covering = this.grants.coveringOf(role, permission);

    if (covering === undefined) {
      const patterns = this.grants.patternsOf(role);

      return trace.no(`${role} grants ${patterns.length === 0 ? 'nothing' : patterns.join(', ')}`, 1);
    }

    return trace.yes(`${role} grants ${coveringText(covering, permission)}`, 1);
  }

  /** Nothing to say when tenants are not checked; a role that acts across tenants settles it. */
  private async staysInATenantOfTheActor(request: CheckRequest, trace: Trace): Promise<boolean> {
    const { tenantOf } = this.options;

    if (tenantOf === undefined) {
      return true;
    }

    const crossing = this.crossingRoleOf(request.actor);

    if (crossing !== undefined) {
      return trace.yes(`${crossing} acts across tenants`);
    }

    return tenantCheck(request, tenantOf, trace);
  }

  private holds(actor: Actor, permission: Permission): boolean {
    return this.rolesOf(actor).some((role) => this.grants.coveringOf(role, permission) !== undefined);
  }

  private crossingRoleOf(actor: Actor): string | undefined {
    const crossing = this.options.crossTenantRoles ?? [];

    return this.rolesOf(actor).find((role) => crossing.includes(role));
  }

  private rolesOf(actor: Actor): readonly string[] {
    const { systemRole } = this.options;

    return isSystem(actor) && systemRole !== undefined ? [...actor.roles, systemRole] : actor.roles;
  }

  private systemRoleNote(actor: Actor): string {
    const { systemRole } = this.options;

    return isSystem(actor) && systemRole !== undefined ? ` (${systemRole} is the role of the system)` : '';
  }
}

/** `billing:*, which covers billing:invoice.void, through controller`: the pattern, what it covers when it is wider, where it comes from. */
function coveringText({ pattern, through }: CoveringGrant, permission: Permission): string {
  const covers = pattern === permission.id ? '' : `, which covers ${permission.id}`;

  return through === undefined ? `${pattern}${covers}` : `${pattern}${covers}, through ${through}`;
}

/** The one tenant a list is read in, when the actor belongs to it. */
function listedTenantOf({ actor, workTenantId }: ListRequest): string | undefined {
  if (workTenantId !== undefined) {
    return belongsTo(actor, workTenantId) ? workTenantId : undefined;
  }

  const tenants = tenantsOf(actor).filter(isTenantId);

  return tenants.length === 1 ? tenants[0] : undefined;
}

/** Whether the actor may work in the tenant of the work: a member, or a system actor, which runs the work of that tenant. */
function belongsTo(actor: Actor, workTenantId: string): boolean {
  return isTenantMember(actor, workTenantId) || isSystem(actor);
}

/** A tenancy option that would silently do nothing is refused at construction, like an unknown inherited role. */
function assertTenancyOptions(
  { tenantOf, crossTenantRoles = [], systemRole }: RoleBasedAuthorizerOptions,
  grants: RoleGrants,
): void {
  const unknown = [...crossTenantRoles, ...(systemRole === undefined ? [] : [systemRole])].find(
    (role) => !grants.declares(role),
  );

  if (unknown !== undefined) {
    throw new AuthorizationSetupError(`Role "${unknown}" is named in the options but declared in no role.`);
  }

  if (tenantOf === undefined && crossTenantRoles.length > 0) {
    throw new AuthorizationSetupError(
      'crossTenantRoles has no effect without tenantOf: give tenantOf (tenantOfContext) to turn the tenant check on.',
    );
  }
}
