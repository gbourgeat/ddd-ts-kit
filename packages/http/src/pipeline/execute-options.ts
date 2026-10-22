import type { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import type { CacheTagHeader } from '../cache/cache-tag-header';
import type { ErrorMapper } from '../error/error-mapper';
import type { FieldDecider } from '../field-access/field-decider';
import type { Representations } from '../representation/representations';
import type { TenantResolver } from '../tenancy/tenant-resolver';
import type { ErrorContext } from './error-context';
import type { GuardRefusal } from './guard-refusal';
import type { RawRequest } from './raw-request';
import type { RouteAround } from './route-around';
import type { UploadReader } from './upload-reader';

export interface ExecuteOptions {
  readonly errorMapper?: ErrorMapper;
  /** Authenticates the request; throw `UnauthorizedError` to refuse it. */
  readonly resolvePrincipal?: (raw: unknown) => unknown;
  /**
   * Runs every handler inside a scope that knows the principal, typically an ambient actor
   * context, so that no route can forget to open it.
   */
  readonly withPrincipal?: <T>(principal: unknown, work: () => Promise<T>) => Promise<T>;
  /** Called for every error answered as a problem, expected or not. Meant for logging. */
  readonly onError?: (error: unknown, context: ErrorContext) => void;
  /**
   * Called, and awaited, for every request a guard of its route refused (`HasRole`, `HasScope`,
   * `TenantMember`, a guard of the project): the refusals at the edge, which no use case sees.
   * `auditGuardRefusals` of `@ddd-ts-kit/audit` writes each one to the audit trail as a denied
   * decision. A hook that fails does not change the answer.
   */
  readonly onGuardRefusal?: (refusal: GuardRefusal) => void | Promise<void>;
  /** Checks each response against the route declaration. Meant for tests. */
  readonly validateResponses?: boolean;
  /** Defaults to the incoming `x-request-id` header when it is well formed, else a UUID. */
  readonly requestId?: (request: RawRequest) => string;
  /**
   * Runs every handler inside `scope.run(execution, ...)`, so loggers, audit columns and tenant
   * scoping read the execution context of the request. Opened outside of `withPrincipal`.
   */
  readonly executionScope?: ExecutionScope;
  /**
   * Names the tenant of each request (`tenantFromSubdomain`, `tenantFromHeader`, `tenantFromPath`,
   * `tenantFromClaim`, or `firstTenantOf` several). The pipeline refuses with 403 an authenticated
   * caller that does not belong to it, before any handler. Absent, or naming none: the tenant of
   * the actor, as before.
   */
  readonly resolveTenant?: TenantResolver;
  /**
   * Gives every request a `deadline` in its execution context, this many milliseconds after it
   * arrived. The pipeline does not interrupt a handler: what honours the deadline reads it.
   */
  readonly requestTimeoutMs?: number;
  /** The instant a request arrived at, for `requestTimeoutMs`. Defaults to the system clock. */
  readonly clock?: Clock;
  /**
   * Wraps the whole handling of each request, from authentication to the answer, refusals
   * included. This is where a tracer names the request after its route: `tracedRoutes()` of
   * `@ddd-ts-kit/tracing` fits as it is.
   */
  readonly around?: RouteAround;
  /**
   * The media types the application answers and reads in (`Representations.standard()`): each
   * request is answered in the one its `Accept` header prefers among those its route declares
   * (406 when none fits), a refusal in the matching problem type, and a body sent in a media
   * type the route consumes is read before its schema validates it (415 for another one). Left
   * out, every answer is JSON whatever the request accepts, as before.
   */
  readonly representations?: Representations;
  /**
   * Decides the fields a schema reserves to some callers (`withFieldAccess`): left out of an
   * answer for an actor who may not read them, refused in a body for one who may not set them.
   * `fieldDeciderOf({ access, clock })` builds it from the `Access` of `@ddd-ts-kit/auth`. Left
   * out, every restricted field is left out of every answer and refused in every body.
   */
  readonly fieldAccess?: FieldDecider;
  /**
   * The header the shared cache in front of the application reads the tags of an answer from:
   * `xkey` for Varnish, `surrogate-key` for Fastly, `cache-tag` for Cloudflare, `cdn-tag` for
   * Bunny. Left out, no answer carries tags: without a shared cache that strips them, they would
   * only reach the client.
   */
  readonly cacheTags?: {
    readonly header: CacheTagHeader;
    /**
     * Files the tags under the tenant of the request, for a multi-tenant application whose purges
     * are filed per tenant too (`perTenant` of `PublishedCacheInvalidation`). Default `false`. A
     * tagged answer to a request that names no tenant is then `no-store`: no purge could meet it.
     */
    readonly perTenant?: boolean;
    /**
     * Whether the cache in front keeps one copy per value of the headers an answer varies on
     * (`Vary`). Default: `true` for `xkey` and `surrogate-key` (Varnish, Fastly), `false` for
     * `cache-tag` and `cdn-tag` (Cloudflare and Bunny ignore `Vary`): a public answer that
     * varies is then refused when the routes are mounted.
     */
    readonly honoursVary?: boolean;
  };
  /** Reads the file of the routes that declare an upload: `multipartUploads()` of `@ddd-ts-kit/http/uploads`. */
  readonly uploads?: UploadReader;
}
