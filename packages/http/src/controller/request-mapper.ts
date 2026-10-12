import {
  Edge,
  type ClassDeclarator,
  type DeclaredDependencies,
  type DependenciesFromSignature,
} from '@ddd-ts-kit/kernel/declarations';

/**
 * The one place that turns what arrived (the validated request and the actor of its execution
 * context) into the command or the query of a use case. Nothing of HTTP is in its signature
 * but the type of the request: another transport maps its own request to the same message.
 */
export interface RequestMapper<Request, Message> {
  map(request: Request): Message;
}

/** Declares a request mapper, so the composition root builds it and hands it to its controller. */
export function RequestMapper<const D extends DeclaredDependencies = DependenciesFromSignature>(
  dependencies?: D,
): ClassDeclarator<RequestMapper<never, unknown>, D> {
  return Edge<RequestMapper<never, unknown>, D>('mapper', dependencies);
}
