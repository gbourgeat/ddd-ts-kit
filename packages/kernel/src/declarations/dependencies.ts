import type { Token } from './token.js';

/** One token per constructor parameter, in order, each resolving to that parameter's type. */
export type DependencyTokens<Args extends readonly unknown[]> = {
  readonly [Index in keyof Args]: Token<Args[Index]>;
};

/** The token list of a constructor, which may only be left out when it takes no parameter. */
export type DependencyList<Args extends readonly unknown[]> = Args extends readonly []
  ? [dependencies?: readonly []]
  : [dependencies: DependencyTokens<Args>];

/** What the compiler shows when a token list does not match the constructor of the class. */
export interface DependencyMismatch<Args extends readonly unknown[]> {
  readonly 'the dependency list must name one token per constructor parameter, in order': DependencyTokens<Args>;
}

/** `unknown` when `Dependencies` names the parameters `Args` in order; a type naming the mistake otherwise. */
export type MatchingDependencies<Args extends readonly unknown[], Dependencies> =
  Dependencies extends DependencyTokens<Args> ? unknown : DependencyMismatch<Args>;

/**
 * A class decorator that accepts only a class whose instances are `Instance` and whose
 * constructor parameters are the ones `Dependencies` names, in order. It serves both decorator
 * modes of the compiler: the standard (TC39) call hands it a context, the legacy
 * `experimentalDecorators` call does not, and it reads nothing but the class.
 */
export type ClassDeclarator<Instance, Dependencies> = <Args extends readonly unknown[]>(
  target: (new (...args: Args) => Instance) & MatchingDependencies<Args, Dependencies>,
  context?: ClassDecoratorContext,
) => void;

export type Dependencies = readonly Token<unknown>[];
