import type { Actor } from '@ddd-ts-kit/kernel';
import type { ControllerRoutesOptions } from '../controller/controller-routes-options';
import type { ExecuteOptions } from '../pipeline/execute-options';

/**
 * How the spec of a route sends its requests, decided once for the whole spec: who calls,
 * whether the guards of a controller stand before it, and the options of the pipeline, the error
 * mapper of the platform for one. The answers are checked against the declaration of the route,
 * unless `validateResponses: false` says otherwise.
 */
export interface RouteOfOptions
  extends Omit<ExecuteOptions, 'resolvePrincipal'>,
    Pick<ControllerRoutesOptions, 'resolve' | 'security' | 'guards'> {
  /**
   * Who sends every request, the principal the pipeline resolves: an authenticated user by
   * default, `user-1` with no role, whom `Authenticated` lets through. `anonymousActor()` of the
   * kernel sends as nobody; an actor with a role passes `HasRole`.
   */
  readonly caller?: Actor;
}
