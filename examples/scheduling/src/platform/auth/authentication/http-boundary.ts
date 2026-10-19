import type { Authenticator } from '@ddd-ts-kit/auth';
import {
  CacheTagHeader,
  firstTenantOf,
  reportHttpErrors,
  servedTenantOf,
  tenantFromClaim,
  tenantFromHeader,
  type ErrorContext,
  type ErrorMapper,
  type GuardRefusal,
  type RouteAround,
  type TenantResolver,
  type UploadReader,
} from '@ddd-ts-kit/http';
import type { Clock, ErrorReporter, ExecutionScope, Logger, Session } from '@ddd-ts-kit/kernel';
import { multipartUploads } from '@ddd-ts-kit/http/uploads';
import { tracedRoutes } from '@ddd-ts-kit/tracing';
import { principalOf } from '@/platform/auth/authentication/principal-of';
import type { Presentation } from '@/platform/http/presentation-of';

/** What the HTTP adapter needs at the edge of the application: spread into its mount options, for every route. */
export interface HttpBoundary extends Presentation {
  readonly resolvePrincipal: (raw: unknown) => Promise<Session>;
  /** Every handler runs inside it, with the correlation id, the actor and the session of its request. */
  readonly executionScope: ExecutionScope;
  /** The one mapping from the code of a domain error to a status: the server and the contract are given the same. */
  readonly errorMapper: ErrorMapper;
  readonly clock: Clock;
  readonly onError: (error: unknown, context: ErrorContext) => void;
  /** The span of a request, named by its route template; probes and documentation routes make none. */
  readonly around: RouteAround;
  /** Reads the file of a controller that declares an upload, as it streams: its size and media types are checked on the way. */
  readonly uploads: UploadReader;
  /** A request a guard refused at the edge, written to the audit trail as a denied decision. */
  readonly onGuardRefusal: (refusal: GuardRefusal) => Promise<void>;
  /**
   * The network of a request: the one it names in `x-tenant-id`, else the one of the token. A
   * caller that names a network it does not belong to is refused (403) before anything runs, and
   * a network this deployment does not serve (`NETWORKS`) is not found (404), whoever names it.
   */
  readonly resolveTenant: TenantResolver;
  /** The header Varnish files a public answer under the tags of its resources from, each tag under the network of the request. */
  readonly cacheTags: { readonly header: CacheTagHeader; readonly perTenant: boolean };
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
  /** The networks served (`NETWORKS`): left out (the tools), any network may be named. */
  readonly networks: readonly string[] | undefined;
  readonly presentation: Presentation;
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
  networks,
  presentation,
}: Edge): HttpBoundary {
  const report = reportHttpErrors(errors);

  return {
    ...presentation,
    resolvePrincipal: principalOf(authenticator),
    executionScope,
    errorMapper,
    clock,
    around: tracedRoutes(),
    resolveTenant: networkOf(networks),
    uploads: multipartUploads(),
    onGuardRefusal: refusals,
    // Filed under the network of the request, as the purges of the outbox are: a purge in one network leaves the others' copies.
    cacheTags: { header: CacheTagHeader.xkey, perTenant: true },
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

/** The network named by the request or the token, held to the networks served when they are known. */
function networkOf(networks: readonly string[] | undefined): TenantResolver {
  const named = firstTenantOf(tenantFromHeader(), tenantFromClaim());

  return networks === undefined ? named : servedTenantOf(named, networks);
}
