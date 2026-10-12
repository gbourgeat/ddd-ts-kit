import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import type { Token } from '../token/token.js';
import { declaring } from './declaring.js';
import type { PortOptions } from './port-options.js';
import type { Settings } from './settings.js';

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
