import { isAnonymous, isSystem, isTenantId, isTenantMember, tenantsOf, type Actor } from '@ddd-ts-kit/kernel';
import type { AccessScope } from '../authorization/access-scope.js';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import { ALLOWED, deny, type Decision } from '../authorization/decision.js';
import { DenialReason } from '../authorization/denial-reason.js';
import type { ListRequest } from '../authorization/list-request.js';
import { AuthorizationSetupError } from '../errors/authorization-setup-error.js';
import type { Grant } from '../permissions/grant.js';
import { grantCovers } from '../permissions/grant-covers.js';
import { grantPattern } from '../permissions/grant-pattern.js';
import type { Permission } from '../permissions/permission.js';

export interface RoleBasedAuthorizerOptions {
  /** What each role grants: permissions, `billing:*` for a whole context, `*` for everything. */
  readonly roles: Readonly<Record<string, readonly Grant[]>>;
  /** The roles a role includes: `{ admin: ['accountant'] }` gives an admin all an accountant has. */
  readonly inherits?: Readonly<Record<string, readonly string[]>>;
  /**
   * Turns the tenant check on: the tenant the request targets, or `undefined` when it targets
   * none. A request about a tenant the actor does not belong to (its `tenantId` or its `tenants`),
   * or about another tenant than the one the work runs in, is refused. See `tenantOfContext`.
   */
  readonly tenantOf?: (request: CheckRequest) => string | undefined | Promise<string | undefined>;
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
  private readonly grants: ReadonlyMap<string, readonly string[]>;

  constructor(private readonly options: RoleBasedAuthorizerOptions) {
    this.grants = effectiveGrants(options);
    assertTenancyOptions(options, this.grants);
  }

  async check(request: CheckRequest): Promise<Decision> {
    if (isAnonymous(request.actor)) {
      return deny(DenialReason.anonymous);
    }

    if (!this.holds(request.actor, request.permission)) {
      return deny(DenialReason.noMatchingRole);
    }

    return (await this.targetsAnotherTenant(request)) ? deny(DenialReason.tenantMismatch) : ALLOWED;
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

    if (this.options.tenantOf === undefined || this.crossesTenants(actor)) {
      return { kind: 'all' };
    }

    const tenantId = listedTenantOf(request);

    return tenantId === undefined ? { kind: 'none' } : { kind: 'filter', filter: { tenantId } };
  }

  private holds(actor: Actor, permission: Permission): boolean {
    return this.rolesOf(actor).some((role) =>
      (this.grants.get(role) ?? []).some((pattern) => grantCovers(pattern, permission)),
    );
  }

  private rolesOf(actor: Actor): readonly string[] {
    const { systemRole } = this.options;

    return isSystem(actor) && systemRole !== undefined ? [...actor.roles, systemRole] : actor.roles;
  }

  private async targetsAnotherTenant(request: CheckRequest): Promise<boolean> {
    if (this.options.tenantOf === undefined || this.crossesTenants(request.actor)) {
      return false;
    }

    const targeted = await this.options.tenantOf(request);

    if (targeted === undefined) {
      return false;
    }

    const elsewhere = request.workTenantId !== undefined && targeted !== request.workTenantId;

    return !isTenantId(targeted) || elsewhere || !belongsTo(request.actor, targeted, request.workTenantId);
  }

  private crossesTenants(actor: Actor): boolean {
    const crossing = this.options.crossTenantRoles ?? [];

    return this.rolesOf(actor).some((role) => crossing.includes(role));
  }
}

/** Whether the actor may work in the tenant: a member, or a system actor running work of that tenant. */
function belongsTo(actor: Actor, tenantId: string, workTenantId: string | undefined): boolean {
  return isTenantMember(actor, tenantId) || (isSystem(actor) && tenantId === workTenantId);
}

/** The one tenant a list is read in, when the actor belongs to it. */
function listedTenantOf({ actor, workTenantId }: ListRequest): string | undefined {
  if (workTenantId !== undefined) {
    return belongsTo(actor, workTenantId, workTenantId) ? workTenantId : undefined;
  }

  const tenants = tenantsOf(actor).filter(isTenantId);

  return tenants.length === 1 ? tenants[0] : undefined;
}

/** A tenancy option that would silently do nothing is refused at construction, like an unknown inherited role. */
function assertTenancyOptions(
  { tenantOf, crossTenantRoles = [], systemRole }: RoleBasedAuthorizerOptions,
  grants: ReadonlyMap<string, readonly string[]>,
): void {
  const unknown = [...crossTenantRoles, ...(systemRole === undefined ? [] : [systemRole])].find(
    (role) => !grants.has(role),
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

function effectiveGrants(options: RoleBasedAuthorizerOptions): ReadonlyMap<string, readonly string[]> {
  const inherits = options.inherits ?? {};
  const roles = new Set([...Object.keys(options.roles), ...Object.keys(inherits)]);
  const own = new Map([...roles].map((role) => [role, (options.roles[role] ?? []).map(grantPattern)]));

  const lineage = (role: string, path: readonly string[]): readonly string[] => {
    if (!roles.has(role)) {
      throw new AuthorizationSetupError(`Role "${path.at(-1) ?? role}" inherits the unknown role "${role}".`);
    }

    if (path.includes(role)) {
      throw new AuthorizationSetupError(`Role hierarchy cycle: ${[...path, role].join(' -> ')}.`);
    }

    return [role, ...(inherits[role] ?? []).flatMap((parent) => lineage(parent, [...path, role]))];
  };

  return new Map(
    [...roles].map((role) => [role, [...new Set(lineage(role, []).flatMap((ancestor) => own.get(ancestor) ?? []))]]),
  );
}
