import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature';
import type { Token } from '../token/token';
import { declaring } from './declaring';
import type { PortOptions } from './port-options';
import type { Settings } from './settings';

/**
 * The adapter of a port through which this context calls another one synchronously: in
 * process today, a remote client tomorrow. `@Gateway(StockGateway)`.
 */
export function Gateway<T, const D extends DeclaredDependencies = DependenciesFromSignature>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Gateway<T, const D extends DeclaredDependencies = DependenciesFromSignature>(
  port: Token<T>,
  options: PortOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;

export function Gateway<T, D extends DeclaredDependencies>(
  port: Token<T>,
  ...settings: Settings<PortOptions, D>
): ClassDeclarator<T, D> {
  return declaring({ role: 'gateway', kind: 'gateway', token: port }, settings);
}
