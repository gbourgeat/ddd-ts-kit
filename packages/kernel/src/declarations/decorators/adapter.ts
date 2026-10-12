import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import type { Token } from '../token/token.js';
import { declaring } from './declaring.js';
import { isDependencies } from './is-dependencies.js';
import type { PortOptions } from './port-options.js';
import type { Settings } from './settings.js';

export interface AdapterOptions extends PortOptions {
  /** What the adapter reaches: an outside system (the default) or the event transport. */
  readonly kind?: 'external' | 'publisher';
}

/**
 * The adapter of any other port of the application layer:
 * `@Adapter(PaymentGateway, { kind: 'external' })`.
 */
export function Adapter<T, const D extends DeclaredDependencies = DependenciesFromSignature>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Adapter<T, const D extends DeclaredDependencies = DependenciesFromSignature>(
  port: Token<T>,
  options: AdapterOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;

export function Adapter<T, D extends DeclaredDependencies>(
  port: Token<T>,
  ...settings: Settings<AdapterOptions, D>
): ClassDeclarator<T, D> {
  const [first] = settings;
  const kind = isDependencies(first) ? undefined : first?.kind;

  return declaring({ role: 'adapter', kind: kind ?? 'external', token: port }, settings);
}
