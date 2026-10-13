import type { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import type { ErrorMapper } from '../error/error-mapper.js';
import type { FieldDecider } from '../field-access/field-decider.js';
import type { Representations } from '../representation/representations.js';
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
}
