import type { ConcreteDependency } from './concrete-dependency.js';
import type { DependencyMismatch } from './dependency-mismatch.js';
import type { DependencyTokens } from './dependency-tokens.js';
import type { StandIns } from './stand-ins.js';

/** `unknown` when `List` names the parameters `Args` in order, by their ports; a type naming the mistake otherwise. */
export type MatchingDependencies<Args extends readonly unknown[], List> =
  List extends DependencyTokens<Args>
    ? [StandIns<Args, List>] extends [never]
      ? unknown
      : ConcreteDependency<StandIns<Args, List>>
    : DependencyMismatch<Args>;
