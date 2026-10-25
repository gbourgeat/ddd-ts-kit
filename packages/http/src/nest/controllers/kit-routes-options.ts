import type { GuardReference } from '../../controller/guard-reference';
import type { RouteGroupClass } from '../../controller/route-group-class';

/** What every route of a Nest controller shares, as a route group of the kit gives it. */
export interface KitRoutesOptions {
  /**
   * A route group of the kit (`@RouteGroup`): its prefix comes before the paths Nest declares, and
   * its tags, guards and error codes before those written here.
   */
  readonly group?: RouteGroupClass;
  /** Run before the guards of each route. */
  readonly guards?: readonly GuardReference[];
  readonly tags?: readonly string[];
  readonly errors?: readonly string[];
}
