import type { DependencyKind } from '@ddd-ts-kit/kernel';
import type { BindingAspect, Token } from '@ddd-ts-kit/kernel/declarations';
import type { BindingSource } from './binding-source.js';
import type { Declarer } from './declarer.js';
import type { Lifetime } from './lifetime.js';
import type { Resolve } from './resolve.js';

export interface Binding {
  readonly token: Token<unknown>;
  readonly module: string;
  readonly source: BindingSource;
  readonly implementation?: string;
  /** Known only for a class: factories resolve what they want at run time. */
  readonly dependencies: readonly Token<unknown>[];
  readonly create: (resolve: Resolve) => unknown;
  /** Absent for a binding written in a module. */
  readonly declaredBy?: Declarer;
  lifetime: Lifetime;
  kind?: DependencyKind;
  /** Outermost first. */
  aspects: readonly BindingAspect[];
}
