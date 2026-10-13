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
   * The media types the route answers in besides `application/json`, chosen per request by its
   * `Accept` header among the representations of the platform: `['application/xml', 'text/csv']`.
   * Each one is documented in the contract with the schema of the response.
   */
  readonly produces?: readonly string[];
  /** The media types the route reads a body in besides `application/json`: `['application/xml']`. */
  readonly consumes?: readonly string[];
}
