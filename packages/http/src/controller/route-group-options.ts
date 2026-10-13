import type { CachePolicy } from '../cache/cache-policy.js';
import type { GuardReference } from './guard-reference.js';
import type { RouteGroupClass } from './route-group-class.js';

export interface RouteGroupOptions {
  /** The group this one refines: its prefix comes first, its tags, guards and error codes are inherited. */
  readonly parent?: RouteGroupClass;
  /** Put before the path of every controller of the group: `/appointments`. Left out, nothing is. */
  readonly prefix?: string;
  readonly tags?: readonly string[];
  /** Run in order before every controller of the group, after the guards of the parent. */
  readonly guards?: readonly GuardReference[];
  /** Error codes every route of the group may answer, such as `FORBIDDEN` behind protected use cases. */
  readonly errors?: readonly string[];
  /** The cache policy of every read of the group, unless a controller declares its own; a child group may replace it. */
  readonly cache?: CachePolicy;
}
