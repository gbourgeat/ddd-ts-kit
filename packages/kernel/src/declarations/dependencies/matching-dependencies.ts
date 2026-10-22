import type { ConcreteDependency } from './concrete-dependency';
import type { DependencyMismatch } from './dependency-mismatch';
import type { DependencyTokens } from './dependency-tokens';
import type { StandIns } from './stand-ins';

/**
 * `unknown` when `List` names the parameters `Args` in order, by their ports, or when there is
 * no list and the constructor states its dependencies itself; a type naming the mistake otherwise.
 */
export type MatchingDependencies<Args extends readonly unknown[], List> = [List] extends [undefined]
  ? unknown
  : List extends DependencyTokens<Args>
    ? [StandIns<Args, List>] extends [never]
      ? unknown
      : ConcreteDependency<StandIns<Args, List>>
    : DependencyMismatch<Args>;
