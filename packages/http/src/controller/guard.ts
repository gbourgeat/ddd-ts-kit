import {
  Edge,
  type ClassDeclarator,
  type DeclaredDependencies,
  type DependenciesFromSignature,
} from '@ddd-ts-kit/kernel/declarations';
import type { GuardDocumentation } from './guard-documentation.js';
import type { GuardRequest } from './guard-request.js';

/**
 * A control at the edge, run in order before the controller: is the caller authenticated, does
 * it hold a role, does the key of the request exist. It lets the request through by returning
 * and refuses it by throwing `UnauthorizedError` or `ForbiddenError`, answered as a problem like
 * any refusal. It knows the caller and the route, never an aggregate: a right that depends on
 * the element is a permission of the use case, held for every caller of the use case.
 */
export interface Guard {
  readonly documents?: GuardDocumentation;

  check(request: GuardRequest): void | Promise<void>;
}

/**
 * Declares a guard that takes dependencies, so the composition root builds it from its
 * constructor: `@Guard() export class ApiKeyGuard implements Guard`. A guard that needs nothing
 * is a plain value (`Authenticated`, `HasRole('auditor')`) and carries no decorator.
 */
export function Guard<const D extends DeclaredDependencies = DependenciesFromSignature>(
  dependencies?: D,
): ClassDeclarator<Guard, D> {
  return Edge<Guard, D>('guard', dependencies);
}
