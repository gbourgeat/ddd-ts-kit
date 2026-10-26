import type { Schema } from '@ddd-ts-kit/validation';
import type { CachePolicy } from '../../cache/cache-policy';
import type { IfMatch } from '../../cache/if-match';
import type { GuardReference } from '../../controller/guard-reference';
import type { FormHints } from '../../forms/form-hints';
import type { UploadSpec } from '../../route/upload-spec';
import type { DtoType } from './dto-type';

/**
 * What a route says besides what Nest's decorators say (its method, its path, its parameters, its
 * status): who may call it, the refusals it answers, its answer, its name in the contract. Every
 * member is optional, and so is `@KitRoute` itself: a method that carries a route decorator of Nest
 * is a route of the kit, named after the method.
 */
export interface KitRouteSpec {
  /**
   * Names the route in the contract, the function of the generated client and the procedure over
   * /rpc and /trpc. Left out, the name of the method: `issueInvoice`.
   */
  readonly operationId?: string;
  /** Left out, the name of the method as a sentence: `Issue invoice`. */
  readonly summary?: string;
  readonly description?: string;
  /** Added to those of @KitRoutes. */
  readonly tags?: readonly string[];
  /** Run after those of @KitRoutes. With none on either, the route is refused: `[Public]` says it is open. */
  readonly guards?: readonly GuardReference[];
  /** Domain error codes the route may answer, added to those of @KitRoutes and of its guards. */
  readonly errors?: readonly string[];
  /** Left out: the status of @HttpCode, else Nest's (201 for POST, 200 otherwise), and no body. */
  readonly response?: {
    readonly status?: number;
    readonly description?: string;
    /** A schema, or a DTO class read through the `schemaOfClass` of the module. */
    readonly body?: Schema<unknown> | DtoType;
    /**
     * The headers the answer carries, each with what it holds. The method then returns
     * `{ body, headers }` (`{ headers }` with no body), and `body` is declared here: its return type
     * is not read for the body.
     */
    readonly headers?: Readonly<Record<string, string>>;
  };
  /** Schemas that replace what the types of the parameters give: for a project that does not write DTO classes. */
  readonly request?: {
    readonly params?: Schema<unknown>;
    readonly query?: Schema<unknown>;
    readonly headers?: Schema<unknown>;
    readonly body?: Schema<unknown>;
  };
  /**
   * A file received as `multipart/form-data`, its field, size and media types stated here and in
   * the contract; `@Upload()` hands it to the method, and `@Body()` takes the text fields.
   */
  readonly upload?: UploadSpec;
  readonly deprecated?: boolean;
  /** Media types answered besides `application/json`, chosen by `Accept`: `['application/xml', 'text/csv']`. */
  readonly produces?: readonly string[];
  /** Media types a body is read in besides `application/json`: `['application/xml']`. */
  readonly consumes?: readonly string[];
  /** Describes the body as a form at `GET /forms/<operationId>` (`formRoutes`): `defineForm(...)` beside the controller. */
  readonly form?: FormHints;
  readonly cache?: CachePolicy;
  readonly ifMatch?: IfMatch;
}
