import type { DependencyKind } from '@ddd-ts-kit/kernel';
import type { BindingAspect } from '@ddd-ts-kit/kernel/declarations';

export interface ValueBindingOptions {
  /** Role passed to the `decorate` hook of the application. */
  as(kind: DependencyKind): this;

  /**
   * Wraps every instance of this binding, the first aspect outermost:
   * `.with(retry(...), timeout(2000))` bounds each attempt. The `decorate` hook of the
   * application comes around them. A value that is not an object is left alone.
   */
  with(...aspects: readonly BindingAspect[]): this;
}
