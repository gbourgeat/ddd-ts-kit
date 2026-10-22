import type { DependencyKind } from '../../application/dependency-kind';
import type { Token } from '../token/token';
import type { BindingAspect } from './binding-aspect';

export interface PortDeclaration {
  readonly role: 'repository' | 'gateway' | 'adapter';
  readonly token: Token<unknown>;
  readonly kind: DependencyKind;
  readonly lifetime: 'singleton' | 'transient';
  /** True when the class takes the place of a binding made by a module listed earlier. */
  readonly replaces: boolean;
  /** Outermost first. */
  readonly aspects: readonly BindingAspect[];
  readonly implementation: new (...args: never) => unknown;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
}
