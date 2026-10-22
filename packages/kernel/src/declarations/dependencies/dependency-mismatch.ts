import type { DependencyTokens } from './dependency-tokens';

/** What the compiler shows when a token list does not match the constructor of the class. */
export interface DependencyMismatch<Args extends readonly unknown[]> {
  readonly 'the dependency list must name one token per constructor parameter, in order': DependencyTokens<Args>;
}
