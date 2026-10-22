import type { DependencyKind } from '@ddd-ts-kit/kernel';
import type { BindingAspect } from '@ddd-ts-kit/kernel/declarations';
import type { Resolve } from './resolve';

/** An aspect a module puts around every binding of some kinds, whichever module declares them. */
export interface KindAspect {
  readonly kinds: readonly DependencyKind[];
  readonly module: string;
  /** Asked for at each instance, so what it resolves may be bound, rebound or faked later. */
  readonly aspect: (resolve: Resolve) => BindingAspect;
}
