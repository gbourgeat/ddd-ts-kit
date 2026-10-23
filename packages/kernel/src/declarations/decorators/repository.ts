import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import type { Token } from '../token/token';
import { declaring } from './declaring';
import type { PortOptions } from './port-options';
import type { Settings } from './settings';

/**
 * The adapter of a repository port of the domain, bound to it:
 * `@Repository(OrderRepository)`. The class implements the port and never extends it.
 */
export function Repository<T, const D extends DeclaredDependencies = DependenciesFromSignature>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Repository<T, const D extends DeclaredDependencies = DependenciesFromSignature>(
  port: Token<T>,
  options: PortOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;

export function Repository<T, D extends DeclaredDependencies>(
  port: Token<T>,
  ...settings: Settings<PortOptions, D>
): ClassDeclarator<T, D> {
  return declaring({ role: 'repository', kind: 'repository', token: port }, settings);
}
