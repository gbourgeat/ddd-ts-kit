import type { Authenticator } from '@ddd-ts-kit/auth';
import type { ErrorContext } from '@ddd-ts-kit/http';
import type { ExecutionScope, Logger, Session } from '@ddd-ts-kit/kernel';
import { principalOf } from './authenticator.js';

/** What the HTTP adapter needs at the edge of the application: spread into its mount options, for every route. */
export interface HttpBoundary {
  readonly resolvePrincipal: (raw: unknown) => Promise<Session>;
  /** Every handler runs inside it, with the correlation id, the actor and the session of its request. */
  readonly executionScope: ExecutionScope;
  readonly onError: (error: unknown, context: ErrorContext) => void;
}

interface Edge {
  readonly authenticator: Authenticator;
  readonly executionScope: ExecutionScope;
  readonly logger: Logger;
}

/** A request is authenticated once, then handled inside the execution scope, so infrastructure sees who acts and under which correlation. */
export function httpBoundary({ authenticator, executionScope, logger }: Edge): HttpBoundary {
  return {
    resolvePrincipal: principalOf(authenticator),
    executionScope,
    // The message of the error may quote data: only the code and the route are logged.
    onError: (_error, context) => {
      if (context.problem.status >= 500) logger.error('request failed', { requestId: context.requestId, correlationId: context.correlationId, operationId: context.operationId, errorCode: context.problem.code });
    },
  };
}
