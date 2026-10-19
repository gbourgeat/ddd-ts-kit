import type { RouteAdmission } from './route-admission.js';
import type { RouteInput } from './route-input.js';
import type { RouteOutput } from './route-output.js';
import type { RouteSpec } from './route-spec.js';

/**
 * A declared route with its handler. The schema types are erased here so that routes of any
 * shape sit in one list; they are checked where it matters, in `defineRoute`.
 */
export interface Route extends RouteSpec {
  /**
   * The class names of the route group of a controller and of every group above it, nearest
   * first: what a document of a split contract selects by. Not part of the contract.
   */
  readonly groups?: readonly string[];

  /**
   * Refuses the caller before the request is read, by throwing a `DomainError` (`UnauthorizedError`,
   * `ForbiddenError`), reported as a refusal at the edge: no upload received, no body read, no
   * validation answered. A controller route admits through the guards that declare an admission.
   */
  admit?(admission: RouteAdmission): void | Promise<void>;

  // A method on purpose: a method parameter is compared bivariantly, which is what lets the
  // precisely typed handler be stored without a type assertion.
  handle(input: RouteInput): RouteOutput | Promise<RouteOutput>;
}
