import type { Authenticator } from '@ddd-ts-kit/auth';
import {
  reportHttpErrors,
  type ErrorContext,
  type ErrorMapper,
  type GuardRefusal,
  type RouteAround,
} from '@ddd-ts-kit/http';
import type { Clock, ErrorReporter, ExecutionScope, Logger, Session } from '@ddd-ts-kit/kernel';
import { tracedRoutes } from '@ddd-ts-kit/tracing';
import { principalOf } from '@/platform/auth/principal-of';

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
  /** A request a guard refused at the edge, written to the audit trail as a denied decision. */
  readonly onGuardRefusal: (refusal: GuardRefusal) => Promise<void>;
}

interface Edge {
  readonly authenticator: Authenticator;
  readonly executionScope: ExecutionScope;
  readonly errorMapper: ErrorMapper;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Where a refusal at the edge is recorded: the audit trail. */
  readonly refusals: (refusal: GuardRefusal) => Promise<void>;
  /** Where a request answered 5xx is reported, unless a bus already reported its failure. */
  readonly errors: ErrorReporter;
}

/** A request is authenticated once, then handled inside the execution scope, so infrastructure sees who acts and under which correlation. */
export function httpBoundary({
  authenticator,
  executionScope,
  errorMapper,
  clock,
  logger,
  refusals,
  errors,
}: Edge): HttpBoundary {
  const report = reportHttpErrors(errors);

  return {
    resolvePrincipal: principalOf(authenticator),
    executionScope,
    errorMapper,
    clock,
    around: tracedRoutes(),
    onGuardRefusal: refusals,
    // The message of the error may quote data: only the code and the route are logged.
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
  };
}
