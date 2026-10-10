import type { DependencyKind } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';

export interface BindingInfo {
  readonly token: Token<unknown>;
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** Present when the binding was declared with `.as(kind)`. */
  readonly kind?: DependencyKind;
}
