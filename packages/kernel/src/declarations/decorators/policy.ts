import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import type { DeclaredPolicy } from '../model/declared-policy.js';
import type { PermissionRef } from '../model/permission-ref.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { record } from '../registry/record.js';
import type { Named } from './named.js';

export interface PolicyOptions<Name extends string = string> {
  /** Stable, lower-case words separated by dots or dashes: the reason given when the rule refuses. */
  readonly name: Name;
}

/**
 * A rule about one permission that needs the loaded element:
 * `@Policy(permissions['invoice.void'], { name: 'only-the-issuer-voids' })`.
 */
export function Policy<const Name extends string, const D extends DeclaredDependencies = DependenciesFromSignature>(
  permission: PermissionRef,
  options: PolicyOptions<Name> & Named<Name, 'name'>,
  dependencies?: D,
): ClassDeclarator<DeclaredPolicy, D> {
  const { name } = options;

  if (name.trim() === '') {
    throw new DeclarationError(`A policy of ${permission.id} needs a name, and it is empty.`);
  }

  return (target) => {
    record(target, { role: 'policy', name, permission, implementation: target, dependencies });
  };
}
