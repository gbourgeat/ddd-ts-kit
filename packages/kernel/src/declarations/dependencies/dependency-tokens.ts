import type { Token } from '../token/token.js';

/** One token per constructor parameter, in order, each resolving to that parameter's type. */
export type DependencyTokens<Args extends readonly unknown[]> = {
  readonly [Index in keyof Args]: Token<Args[Index]>;
};
