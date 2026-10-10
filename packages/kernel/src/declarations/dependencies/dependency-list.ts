import type { DependencyTokens } from './dependency-tokens.js';
import type { MatchingDependencies } from './matching-dependencies.js';

/**
 * The token list of a constructor as a rest parameter, which may only be left out when the
 * constructor takes no parameter.
 */
export type DependencyList<Args extends readonly unknown[], List = DependencyTokens<Args>> = Args extends readonly []
  ? [dependencies?: readonly []]
  : [dependencies: List & MatchingDependencies<Args, List>];
