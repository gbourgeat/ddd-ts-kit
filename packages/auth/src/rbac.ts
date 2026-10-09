import { isAnonymous, isSystem, type Actor } from '@ddd-ts-kit/kernel';
import {
  ALLOWED,
  DenialReason,
  deny,
  type AccessScope,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type ListRequest,
} from './authorizer.js';
import { AuthorizationSetupError } from './errors.js';
import { grantCovers, grantPattern, type Grant } from './grants.js';
import type { Permission } from './permissions.js';

export interface RoleBasedAuthorizerOptions {
  /** What each role grants: permissions, `billing:*` for a whole context, `*` for everything. */
  readonly roles: Readonly<Record<string, readonly Grant[]>>;
  /** The roles a role includes: `{ admin: ['accountant'] }` gives an admin all an accountant has. */
  readonly inherits?: Readonly<Record<string, readonly string[]>>;
  /**
   * Turns the tenant check on: the tenant the request targets, or `undefined` when it targets
   * none. A request about another tenant than the actor's is refused. See `tenantOfContext`.
   */
  readonly tenantOf?: (request: CheckRequest) => string | undefined | Promise<string | undefined>;
  /** Roles that act across tenants, such as a platform operator. */
  readonly crossTenantRoles?: readonly string[];
  /** The role given to actors of type `system`, which carry none. Default: no role. */
  readonly systemRole?: string;
}

/** For `tenantOf`: reads `context.tenantId`, which `requires(..., { context })` provides. */
export function tenantOfContext(request: CheckRequest): string | undefined {
  const tenantId = request.context?.['tenantId'];
  return typeof tenantId === 'string' ? tenantId : undefined;
}

/** RBAC: an actor may do what one of its roles grants. It decides on actions, not on elements. */
export class RoleBasedAuthorizer implements Authorizer {
  readonly #grants: ReadonlyMap<string, readonly string[]>;

  constructor(private readonly options: RoleBasedAuthorizerOptions) {
    this.#grants = effectiveGrants(options);
  }

  async check(request: CheckRequest): Promise<Decision> {
    if (isAnonymous(request.actor)) return deny(DenialReason.anonymous);
    if (!this.#holds(request.actor, request.permission)) return deny(DenialReason.noMatchingRole);
    return (await this.#targetsAnotherTenant(request)) ? deny(DenialReason.tenantMismatch) : ALLOWED;
  }

  /** Constant time: everything, nothing, or the rows of the actor's tenant. */
  async listAccessible({ actor, permission }: ListRequest): Promise<AccessScope> {
    if (isAnonymous(actor) || !this.#holds(actor, permission)) return { kind: 'none' };
    if (this.options.tenantOf === undefined || this.#crossesTenants(actor)) return { kind: 'all' };
    return actor.tenantId === undefined
      ? { kind: 'none' }
      : { kind: 'filter', filter: { tenantId: actor.tenantId } };
  }

  #holds(actor: Actor, permission: Permission): boolean {
    return this.#rolesOf(actor).some((role) =>
      (this.#grants.get(role) ?? []).some((pattern) => grantCovers(pattern, permission)),
    );
  }

  #rolesOf(actor: Actor): readonly string[] {
    const { systemRole } = this.options;
    return isSystem(actor) && systemRole !== undefined ? [...actor.roles, systemRole] : actor.roles;
  }

  async #targetsAnotherTenant(request: CheckRequest): Promise<boolean> {
    if (this.options.tenantOf === undefined || this.#crossesTenants(request.actor)) return false;
    const targeted = await this.options.tenantOf(request);
    return targeted !== undefined && targeted !== request.actor.tenantId;
  }

  #crossesTenants(actor: Actor): boolean {
    const crossing = this.options.crossTenantRoles ?? [];
    return this.#rolesOf(actor).some((role) => crossing.includes(role));
  }
}

function effectiveGrants(options: RoleBasedAuthorizerOptions): ReadonlyMap<string, readonly string[]> {
  const inherits = options.inherits ?? {};
  const roles = new Set([...Object.keys(options.roles), ...Object.keys(inherits)]);
  const own = new Map([...roles].map((role) => [role, (options.roles[role] ?? []).map(grantPattern)]));
  const lineage = (role: string, path: readonly string[]): readonly string[] => {
    if (!roles.has(role)) throw new AuthorizationSetupError(`Role "${path.at(-1) ?? role}" inherits the unknown role "${role}".`);
    if (path.includes(role)) throw new AuthorizationSetupError(`Role hierarchy cycle: ${[...path, role].join(' -> ')}.`);
    return [role, ...(inherits[role] ?? []).flatMap((parent) => lineage(parent, [...path, role]))];
  };
  return new Map(
    [...roles].map((role) => [role, [...new Set(lineage(role, []).flatMap((ancestor) => own.get(ancestor) ?? []))]]),
  );
}
