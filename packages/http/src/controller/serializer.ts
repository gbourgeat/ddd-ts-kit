import {
  Edge,
  type ClassDeclarator,
  type DeclaredDependencies,
  type DependenciesFromSignature,
} from '@ddd-ts-kit/kernel/declarations';

/**
 * The one place that turns the result of a use case into the body a client reads: dates to
 * text, internal fields left out. Another format serializes the same result its own way.
 */
export interface Serializer<Result, Body> {
  serialize(result: Result): Body;
}

/** Declares a serializer, so the composition root builds it and hands it to its controller. */
export function Serializer<const D extends DeclaredDependencies = DependenciesFromSignature>(
  dependencies?: D,
): ClassDeclarator<Serializer<never, unknown>, D> {
  return Edge<Serializer<never, unknown>, D>('serializer', dependencies);
}
