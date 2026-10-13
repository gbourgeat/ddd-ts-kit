import type { CachePolicy } from '../cache/cache-policy.js';
import type { IfMatch } from '../cache/if-match.js';
import type { HttpMethod } from './http-method.js';
import type { RequestSchemas } from './request-schemas.js';
import type { ResponsesSpec } from './responses-spec.js';

export interface RouteSpec<
  Request extends RequestSchemas = RequestSchemas,
  Responses extends ResponsesSpec = ResponsesSpec,
> {
  readonly method: HttpMethod;
  /** Express-style path: literal segments and `:name` parameters, for example `/orders/:orderId`. */
  readonly path: string;
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly request?: Request;
  readonly responses: Responses;
  /** Domain error codes this route may answer; they are documented in the contract. */
  readonly errors?: readonly string[];
  /**
   * Names of the security schemes that apply, or `false` for a route anybody may call. Required:
   * a route is never public by omission. An empty list is refused, it would say the same as `false`.
   */
  readonly security: readonly string[] | false;
  readonly deprecated?: boolean;
  /**
   * How the caches on the way may keep the answer. Left out, a route that is not public answers
   * `Cache-Control: no-store`, and a public one says nothing.
   */
  readonly cache?: CachePolicy;
  /**
   * A write conditional on the version the client read: the version named in `If-Match` is
   * handed to the handler as `context.expectedVersion`, for the use case to compare.
   */
  readonly ifMatch?: IfMatch;
}
