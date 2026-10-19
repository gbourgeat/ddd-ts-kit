import type { Authenticator } from '@ddd-ts-kit/auth';
{{#if httpCache.varnish}}
{{#unless httpCache.perTenant}}
import { CacheTagHeader } from '@ddd-ts-kit/http';
{{/unless}}
{{#if httpCache.perTenant}}
import { CacheTagHeader, tenantFromHeader, type TenantResolver } from '@ddd-ts-kit/http';
{{/if}}
{{/if}}
{{#if errors.none}}
import type { ErrorContext, ErrorMapper, {{#if audit.on}}GuardRefusal, {{/if}}RouteAround{{#if files.http}}, UploadReader{{/if}} } from '@ddd-ts-kit/http';
import type { Clock, ExecutionScope, Logger, Session } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if errors.sentry}}
{{#unless audit.on}}
{{#unless files.http}}
import { reportHttpErrors, type ErrorContext, type ErrorMapper, type RouteAround } from '@ddd-ts-kit/http';
{{/unless}}
{{#if files.http}}
import {
  reportHttpErrors,
  type ErrorContext,
  type ErrorMapper,
  type RouteAround,
  type UploadReader,
} from '@ddd-ts-kit/http';
{{/if}}
{{/unless}}
{{#if audit.on}}
import {
  reportHttpErrors,
  type ErrorContext,
  type ErrorMapper,
  type GuardRefusal,
  type RouteAround,
{{#if files.http}}
  type UploadReader,
{{/if}}
} from '@ddd-ts-kit/http';
{{/if}}
import type { Clock, ErrorReporter, ExecutionScope, Logger, Session } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if files.http}}
import { multipartUploads } from '@ddd-ts-kit/http/uploads';
{{/if}}
import { tracedRoutes } from '@ddd-ts-kit/tracing';
import { principalOf } from '{{alias.platform}}/auth/authentication/principal-of{{alias.ext}}';
{{#if presentation.any}}
import type { Presentation } from '{{alias.platform}}/http/presentation-of{{alias.ext}}';
{{/if}}

/** What the HTTP adapter needs at the edge of the application: spread into its mount options, for every route. */
export interface HttpBoundary{{#if presentation.any}} extends Presentation{{/if}} {
  readonly resolvePrincipal: (raw: unknown) => Promise<Session>;
  /** Every handler runs inside it, with the correlation id, the actor and the session of its request. */
  readonly executionScope: ExecutionScope;
  /** The one mapping from the code of a domain error to a status: the server and the contract are given the same. */
  readonly errorMapper: ErrorMapper;
  readonly clock: Clock;
  readonly onError: (error: unknown, context: ErrorContext) => void;
  /** The span of a request, named by its route template; probes and documentation routes make none. */
  readonly around: RouteAround;
{{#if httpCache.varnish}}
  /** The header Varnish files a public answer under the tags of its resources from. */
  readonly cacheTags: { readonly header: CacheTagHeader; readonly perTenant?: boolean };
{{/if}}
{{#if httpCache.perTenant}}
  /**
   * The tenant of a request that names one in `x-tenant-id`, an anonymous one on a public route included: its
   * answers are then filed under that tenant, and vary on the header. Without it, the tenant of the caller.
   */
  readonly resolveTenant: TenantResolver;
{{/if}}
{{#if files.http}}
  /** Reads the file of a controller that declares an upload, as it streams: its size and media types are checked on the way. */
  readonly uploads: UploadReader;
{{/if}}
{{#if audit.on}}
  /** A request a guard refused at the edge, written to the audit trail as a denied decision. */
  readonly onGuardRefusal: (refusal: GuardRefusal) => Promise<void>;
{{/if}}
}

interface Edge {
  readonly authenticator: Authenticator;
  readonly executionScope: ExecutionScope;
  readonly errorMapper: ErrorMapper;
  readonly clock: Clock;
  readonly logger: Logger;
{{#if audit.on}}
  /** Where a refusal at the edge is recorded: the audit trail. */
  readonly refusals: (refusal: GuardRefusal) => Promise<void>;
{{/if}}
{{#if errors.sentry}}
  /** Where a request answered 5xx is reported, unless a bus already reported its failure. */
  readonly errors: ErrorReporter;
{{/if}}
{{#if presentation.any}}
  readonly presentation: Presentation;
{{/if}}
}

/** A request is authenticated once, then handled inside the execution scope, so infrastructure sees who acts and under which correlation. */
{{#if errors.none}}
{{#unless presentation.widensEdge}}
export function httpBoundary({ authenticator, executionScope, errorMapper, clock, logger }: Edge): HttpBoundary {
{{/unless}}
{{#if presentation.widensEdge}}
export function httpBoundary({
  authenticator,
  executionScope,
  errorMapper,
  clock,
  logger,
{{#if audit.on}}
  refusals,
{{/if}}
{{#if presentation.any}}
  presentation,
{{/if}}
}: Edge): HttpBoundary {
{{/if}}
{{/if}}
{{#if errors.sentry}}
export function httpBoundary({
  authenticator,
  executionScope,
  errorMapper,
  clock,
  logger,
{{#if audit.on}}
  refusals,
{{/if}}
  errors,
{{#if presentation.any}}
  presentation,
{{/if}}
}: Edge): HttpBoundary {
  const report = reportHttpErrors(errors);

{{/if}}
  return {
{{#if presentation.any}}
    ...presentation,
{{/if}}
    resolvePrincipal: principalOf(authenticator),
    executionScope,
    errorMapper,
    clock,
    around: tracedRoutes(),
{{#if httpCache.varnish}}
{{#if httpCache.perTenant}}
    // Filed under the tenant of the request, as the purges of the outbox are.
    cacheTags: { header: CacheTagHeader.xkey, perTenant: true },
    resolveTenant: tenantFromHeader(),
{{/if}}
{{#unless httpCache.perTenant}}
    cacheTags: { header: CacheTagHeader.xkey },
{{/unless}}
{{/if}}
{{#if files.http}}
    uploads: multipartUploads(),
{{/if}}
{{#if audit.on}}
    onGuardRefusal: refusals,
{{/if}}
    // The message of the error may quote data: only the code and the route are logged.
{{#if errors.none}}
    onError: (_error, context) => {
      if (context.problem.status < 500) {
        return;
      }

      logger.error('request failed', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        operationId: context.operationId,
        errorCode: context.problem.code,
      });
    },
{{/if}}
{{#if errors.sentry}}
    onError: (error, context) => {
      if (context.problem.status < 500) {
        return;
      }

      logger.error('request failed', {
        requestId: context.requestId,
        correlationId: context.correlationId,
        operationId: context.operationId,
        errorCode: context.problem.code,
      });

      report(error, context);
    },
{{/if}}
  };
}
