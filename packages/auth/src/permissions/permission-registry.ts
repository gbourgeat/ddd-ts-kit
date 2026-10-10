import { AuthorizationSetupError } from '../errors/authorization-setup-error.js';
import type { Permission } from './permission.js';

/** Every permission of the application, for generated documentation and administration screens. */
export class PermissionRegistry {
  private readonly byId = new Map<string, Permission>();

  static of(...sets: readonly Readonly<Record<string, Permission>>[]): PermissionRegistry {
    const registry = new PermissionRegistry();

    for (const permission of sets.flatMap((set) => Object.values(set))) registry.add(permission);

    return registry;
  }

  all(): readonly Permission[] {
    return [...this.byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  contexts(): readonly string[] {
    return [...new Set(this.all().map((permission) => permission.context))];
  }

  inContext(context: string): readonly Permission[] {
    return this.all().filter((permission) => permission.context === context);
  }

  find(id: string): Permission | undefined {
    return this.byId.get(id);
  }

  private add(permission: Permission): void {
    if (this.byId.has(permission.id)) {
      throw new AuthorizationSetupError(`Permission "${permission.id}" is declared twice.`);
    }

    this.byId.set(permission.id, permission);
  }
}
