import type { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import type { ErrorMapper } from '../error/error-mapper.js';
import type { TenantResolver } from '../tenancy/tenant-resolver.js';
import type { ErrorContext } from './error-context.js';
import type { RawRequest } from './raw-request.js';
import type { RouteAround } from './route-around.js';

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
}
