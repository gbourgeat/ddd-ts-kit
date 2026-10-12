import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import type { Token } from '../token/token.js';
import { declaring } from './declaring.js';
import type { PortOptions } from './port-options.js';
import type { Settings } from './settings.js';

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
