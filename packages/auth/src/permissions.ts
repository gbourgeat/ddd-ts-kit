import { AuthorizationSetupError } from './errors.js';

/** A right somebody may hold, declared once by the context that owns it. */
export interface Permission<Id extends string = string> {
  /** Stable and unique: `<context>:<name>`. What roles, policies and audit trails refer to. */
  readonly id: Id;
  readonly context: string;
  readonly name: string;
  readonly description: string;
}

export interface PermissionDeclaration {
  readonly description: string;
}

export type PermissionSet<Context extends string, Name extends string> = {
  readonly [N in Name]: Permission<`${Context}:${N}`>;
};

const CONTEXT_PATTERN = /^[a-z][a-z0-9-]*$/;
const NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

/**
 * The permissions of one bounded context, as data:
 * `definePermissions('billing', { 'invoice.issue': { description: 'Issue an invoice' } })`.
 */
export function definePermissions<
  const Context extends string,
  const Declarations extends Readonly<Record<string, PermissionDeclaration>>,
>(context: Context, declarations: Declarations): PermissionSet<Context, keyof Declarations & string> {
  assertMatches(context, CONTEXT_PATTERN, 'context');
  const permissions = Object.entries(declarations).map(([name, { description }]) => {
    assertMatches(name, NAME_PATTERN, 'permission');
    return [name, Object.freeze({ id: `${context}:${name}`, context, name, description })];
  });
  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- one entry was built per key of Declarations with the id of that key, which the compiler cannot follow through Object.fromEntries
  return Object.freeze(Object.fromEntries(permissions)) as PermissionSet<Context, keyof Declarations & string>;
}

function assertMatches(value: string, pattern: RegExp, what: string): void {
  if (pattern.test(value)) return;
  throw new AuthorizationSetupError(
    `"${value}" is not a valid ${what} name: lower-case words, digits and dashes${what === 'permission' ? ', dot-separated' : ''}.`,
  );
}

export function isPermission(value: unknown): value is Permission {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || !('context' in value) || !('name' in value) || !('description' in value)) return false;
  return typeof value.id === 'string' && value.id === `${String(value.context)}:${String(value.name)}`;
}

/** Every permission of the application, for generated documentation and administration screens. */
export class PermissionRegistry {
  readonly #byId = new Map<string, Permission>();

  static of(...sets: readonly Readonly<Record<string, Permission>>[]): PermissionRegistry {
    const registry = new PermissionRegistry();
    for (const permission of sets.flatMap((set) => Object.values(set))) registry.#add(permission);
    return registry;
  }

  all(): readonly Permission[] {
    return [...this.#byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  contexts(): readonly string[] {
    return [...new Set(this.all().map((permission) => permission.context))];
  }

  inContext(context: string): readonly Permission[] {
    return this.all().filter((permission) => permission.context === context);
  }

  find(id: string): Permission | undefined {
    return this.#byId.get(id);
  }

  #add(permission: Permission): void {
    if (this.#byId.has(permission.id)) {
      throw new AuthorizationSetupError(`Permission "${permission.id}" is declared twice.`);
    }
    this.#byId.set(permission.id, permission);
  }
}
