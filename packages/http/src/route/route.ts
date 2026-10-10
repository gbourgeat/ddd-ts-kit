import type { RouteInput } from './route-input.js';
import type { RouteOutput } from './route-output.js';
import type { RouteSpec } from './route-spec.js';

/**
 * A declared route with its handler. The schema types are erased here so that routes of any
 * shape sit in one list; they are checked where it matters, in `defineRoute`.
 */
export interface Route extends RouteSpec {
  // A method on purpose: a method parameter is compared bivariantly, which is what lets the
  // precisely typed handler be stored without a type assertion.
  handle(input: RouteInput): RouteOutput | Promise<RouteOutput>;
}
