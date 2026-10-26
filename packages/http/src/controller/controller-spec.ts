import type { Schema } from '@ddd-ts-kit/validation';
import type { FormHints } from '../forms/form-hints';
import type { CachePolicy } from '../cache/cache-policy';
import type { IfMatch } from '../cache/if-match';
import type { HttpMethod } from '../route/http-method';
import type { UploadSpec } from '../route/upload-spec';
import type { ControllerResponse } from './controller-response';
import type { GuardReference } from './guard-reference';
import type { RouteGroupClass } from './route-group-class';

/** Everything a route says, in the decorator of its controller and nowhere else. */
export interface ControllerSpec {
  /** The group the route belongs to: it gives a prefix, tags, guards and error codes. */
  readonly group?: RouteGroupClass;
  readonly method: HttpMethod;
  /** Literal segments and `:name` parameters, after the prefix of the group; `/` for the prefix itself. */
  readonly path: string;
  /** Left out, the name of the class without `Controller`, in camelCase. */
  readonly operationId?: string;
  readonly summary: string;
  readonly description?: string;
  /** Added to the tags of the group. */
  readonly tags?: readonly string[];
  readonly params?: Schema<unknown>;
  readonly query?: Schema<unknown>;
  readonly headers?: Schema<unknown>;
  readonly body?: Schema<unknown>;
  /**
   * A file received as `multipart/form-data`, its field, size and media types stated here and in
   * the contract; `handle` then reads `upload`, and `body` describes the text fields. Send the
   * text fields before the file: what follows it is not read.
   */
  readonly upload?: UploadSpec;
  /**
   * The body is left as it arrives, unparsed and not validated: `handle` reads the bytes in
   * `context.stream` and the headers as they came in `context.rawHeaders`, to verify a signature made
   * over them (a webhook) before parsing anything. The contract describes it as `application/octet-stream`.
   * With `body`, `upload` or `consumes` it is refused: they read the body, and this one is not read.
   */
  readonly rawBody?: boolean;
  readonly response: ControllerResponse;
  /** Domain error codes the route may answer, added to those of its group and of its guards. */
  readonly errors?: readonly string[];
  /** Run after the guards of the group. With no group, at least one is required: `[Public]` says the route is open. */
  readonly guards?: readonly GuardReference[];
  readonly deprecated?: boolean;
  /** Media types answered besides `application/json`, chosen by `Accept`: `['application/xml', 'text/csv']`. */
  readonly produces?: readonly string[];
  /** Media types a body is read in besides `application/json`: `['application/xml']`. */
  readonly consumes?: readonly string[];
  /** Describes the body as a form at `GET /forms/<operationId>` (`formRoutes`): `defineForm(...)` next to the schemas, or `{}`. */
  readonly form?: FormHints;
  /** How the caches on the way may keep the answer; replaces the policy of the group. */
  readonly cache?: CachePolicy;
  /** A write conditional on the version the client read, handed to `handle` as `context.expectedVersion`. */
  readonly ifMatch?: IfMatch;
}
