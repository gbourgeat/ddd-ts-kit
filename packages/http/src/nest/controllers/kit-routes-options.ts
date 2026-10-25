import type { GuardReference } from '../../controller/guard-reference';

/** What every route of a Nest controller shares, as a route group of the kit gives it. */
export interface KitRoutesOptions {
  /** Run before the guards of each route. */
  readonly guards?: readonly GuardReference[];
  readonly tags?: readonly string[];
  readonly errors?: readonly string[];
}
