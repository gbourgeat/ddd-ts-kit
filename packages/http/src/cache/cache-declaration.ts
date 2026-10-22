import type { HttpMethod } from '../route/http-method';
import type { CachePolicy } from './cache-policy';
import type { IfMatch } from './if-match';

/** What the check of a cache policy reads of the route that declares it. */
export interface CacheDeclaration {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** `false` for a route anybody may call: its answer does not depend on the caller. */
  readonly security: readonly string[] | false;
  readonly cache?: CachePolicy;
  readonly ifMatch?: IfMatch;
}
