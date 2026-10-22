import { AuthorizationSetupError } from '../errors/authorization-setup-error';
import type { Grant } from '../permissions/grant';
import { grantCovers } from '../permissions/grant-covers';
import { grantPattern } from '../permissions/grant-pattern';
import type { Permission } from '../permissions/permission';

export interface RoleGrantsDefinition {
  /** What each role grants: permissions, `billing:*` for a whole context, `*` for everything. */
  readonly roles: Readonly<Record<string, readonly Grant[]>>;
  /** The roles a role includes: `{ admin: ['accountant'] }` gives an admin all an accountant has. */
  readonly inherits?: Readonly<Record<string, readonly string[]>>;
}

/** A grant that covers a permission, and the included role it comes from when it is not the role's own. */
export interface CoveringGrant {
  readonly pattern: string;
  readonly through?: string;
}

/**
 * What each role grants: its own grants, then those of the roles it includes, at any distance.
 * Resolved once, so an included role nobody declares and a hierarchy that loops are refused
 * here, before the first check.
 */
export class RoleGrants {
  private readonly own = new Map<string, readonly string[]>();
  /** The roles each role includes, nearest first. */
  private readonly included = new Map<string, readonly string[]>();
  private readonly inherits: Readonly<Record<string, readonly string[]>>;

  constructor(definition: RoleGrantsDefinition) {
    this.inherits = definition.inherits ?? {};
    const roles = [...new Set([...Object.keys(definition.roles), ...Object.keys(this.inherits)])];

    for (const role of roles) {
      this.own.set(role, (definition.roles[role] ?? []).map(grantPattern));
    }

    for (const role of roles) {
      this.included.set(role, this.lineageOf(role, [role]));
    }
  }

  declares(role: string): boolean {
    return this.own.has(role);
  }

  /** Everything the role grants: its own grants, then those of each role it includes. */
  patternsOf(role: string): readonly string[] {
    return [...new Set(this.selfAndIncluded(role).flatMap((each) => this.own.get(each) ?? []))];
  }

  /** The first grant of the role that covers the permission: its own before those of the roles it includes. */
  coveringOf(role: string, permission: Permission): CoveringGrant | undefined {
    for (const each of this.selfAndIncluded(role)) {
      const pattern = (this.own.get(each) ?? []).find((candidate) => grantCovers(candidate, permission));

      if (pattern !== undefined) {
        return each === role ? { pattern } : { pattern, through: each };
      }
    }

    return undefined;
  }

  private selfAndIncluded(role: string): readonly string[] {
    return [role, ...(this.included.get(role) ?? [])];
  }

  /** The roles the last role of the path includes, at any distance; the path says where a loop closes. */
  private lineageOf(role: string, path: readonly string[]): readonly string[] {
    return (this.inherits[role] ?? []).flatMap((parent) => {
      if (!this.own.has(parent)) {
        throw new AuthorizationSetupError(`Role "${role}" inherits the unknown role "${parent}".`);
      }

      if (path.includes(parent)) {
        throw new AuthorizationSetupError(`Role hierarchy cycle: ${[...path, parent].join(' -> ')}.`);
      }

      return [parent, ...this.lineageOf(parent, [...path, parent])];
    });
  }
}
