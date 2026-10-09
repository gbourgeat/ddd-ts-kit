import type { DeclaredPolicy, PermissionRef } from './declaration.js';
import type { ClassDeclarator, Dependencies } from './dependencies.js';
import { DeclarationError, record } from './registry.js';
import type { Named } from './listeners.js';

export interface PolicyOptions<Name extends string = string> {
  /** Stable, lower-case words separated by dots or dashes: the reason given when the rule refuses. */
  readonly name: Name;
}

/**
 * A rule about one permission that needs the loaded element:
 * `@Policy(permissions['invoice.void'], { name: 'only-the-issuer-voids' })`.
 */
export function Policy<const Name extends string, const D extends Dependencies = readonly []>(
  permission: PermissionRef,
  options: PolicyOptions<Name> & Named<Name, 'name'>,
  dependencies?: D,
): ClassDeclarator<DeclaredPolicy, D> {
  const { name } = options;
  if (name.trim() === '') throw new DeclarationError(`A policy of ${permission.id} needs a name, and it is empty.`);
  return (target) => {
    record(target, { role: 'policy', name, permission, implementation: target, dependencies: dependencies ?? [] });
  };
}
