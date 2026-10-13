import type { Authenticator } from '@ddd-ts-kit/auth';
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
import { principalOf } from '{{alias.platform}}/auth/principal-of{{alias.ext}}';

/** What the HTTP adapter needs at the edge of the application: spread into its mount options, for every route. */
export interface HttpBoundary {
  readonly resolvePrincipal: (raw: unknown) => Promise<Session>;
  /** Every handler runs inside it, with the correlation id, the actor and the session of its request. */
  readonly executionScope: ExecutionScope;
  /** The one mapping from the code of a domain error to a status: the server and the contract are given the same. */
  readonly errorMapper: ErrorMapper;
  readonly clock: Clock;
  readonly onError: (error: unknown, context: ErrorContext) => void;
  /** The span of a request, named by its route template; probes and documentation routes make none. */
  readonly around: RouteAround;
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
}

/** A request is authenticated once, then handled inside the execution scope, so infrastructure sees who acts and under which correlation. */
{{#if errors.none}}
{{#unless audit.on}}
export function httpBoundary({ authenticator, executionScope, errorMapper, clock, logger }: Edge): HttpBoundary {
{{/unless}}
{{#if audit.on}}
export function httpBoundary({
  authenticator,
  executionScope,
  errorMapper,
  clock,
  logger,
  refusals,
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
}: Edge): HttpBoundary {
  const report = reportHttpErrors(errors);

{{/if}}
  return {
    resolvePrincipal: principalOf(authenticator),
    executionScope,
    errorMapper,
    clock,
    around: tracedRoutes(),
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
