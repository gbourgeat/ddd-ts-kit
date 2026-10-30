import type { MatchingDependencies } from './matching-dependencies';

/**
 * A class decorator that accepts only a class whose instances are `Instance` and whose
 * constructor parameters are the ones `List` names, in order; without a list, any constructor,
 * whose signature then states the dependencies, and whose static members are `Statics`. It serves both decorator
 * modes of the compiler: the standard (TC39) call hands it a context, the legacy
 * `experimentalDecorators` call does not, and it reads nothing but the class.
 */
export type ClassDeclarator<Instance, List, Statics = unknown> = <Args extends readonly unknown[]>(
  target: (new (...args: Args) => Instance) & MatchingDependencies<Args, List> & Statics,
  context?: ClassDecoratorContext,
) => void;
