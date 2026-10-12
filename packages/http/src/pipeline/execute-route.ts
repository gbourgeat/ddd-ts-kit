import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import { createErrorMapper } from '../error/create-error-mapper.js';
import { toProblem } from '../error/to-problem.js';
import type { RequestContext } from '../route/request-context.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { assertDeclaredResponse } from './assert-declared-response.js';
import { CORRELATION_HEADER } from './correlation-header.js';
import { correlationIdOf } from './correlation-id-of.js';
import type { ErrorContext } from './error-context.js';
import type { ExecuteOptions } from './execute-options.js';
import { executionOfRequest } from './execution-of-request.js';
import type { RawRequest } from './raw-request.js';
import type { RouteResponse } from './route-response.js';
import { resolvedTenant } from '../tenancy/resolved-tenant.js';
import { validateRequest } from './validate-request.js';
import { wellFormedIdentifier } from './well-formed-identifier.js';

interface Call {
  readonly route: Route;
  readonly request: RawRequest;
  readonly options: ExecuteOptions;
  readonly requestId: string;
  readonly correlationId: string;
  /** Filled as the request advances, for the error hook to say how far it went. */
  readonly reached: { execution?: ExecutionContext };
}

const defaultErrorMapper = createErrorMapper();
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

export async function executeRoute(
  route: Route,
  request: RawRequest,
  options: ExecuteOptions = {},
): Promise<RouteResponse> {
  const requestId = (options.requestId ?? defaultRequestId)(request);
  const correlationId = correlationIdOf(request.headers, requestId);
  const call: Call = { route, request, options, requestId, correlationId, reached: {} };
  const respond = (): Promise<RouteResponse> => responded(call);

  return options.around === undefined ? respond() : options.around(route, respond);
}

async function responded(call: Call): Promise<RouteResponse> {
  try {
    return answer(await handled(call), call);
  } catch (error) {
    return refusal(error, call);
  }
}

function defaultRequestId(request: RawRequest): string {
  return wellFormedIdentifier(request.headers['x-request-id']) ?? globalThis.crypto.randomUUID();
}

async function handled(call: Call): Promise<RouteOutput> {
  const { route, request, options, requestId } = call;
  const principal = await options.resolvePrincipal?.(request.raw);
  const input = validateRequest(route, request);
  const { headers } = request;
  const execution = executionOf(call, principal, input.params);

  call.reached.execution = execution;

  const context: RequestContext = {
    requestId,
    execution,
    raw: request.raw,
    rawHeaders: headers,
    ...(principal === undefined ? {} : { principal }),
  };

  const handle = async (): Promise<RouteOutput> => route.handle({ ...input, context });
  const asPrincipal = (): Promise<RouteOutput> => options.withPrincipal?.(principal, handle) ?? handle();
  const result = await (options.executionScope?.run(execution, asPrincipal) ?? asPrincipal());

  if (options.validateResponses === true) {
    assertDeclaredResponse(route, result);
  }

  return result;
}

/** The execution context of the request, in the tenant it names once the caller is known to belong to it. */
function executionOf({ request, options, correlationId }: Call, principal: unknown, params: unknown): ExecutionContext {
  const { headers } = request;
  const deadline = deadlineOf(options);
  const execution = executionOfRequest({ correlationId, headers, principal, deadline });
  const tenantId = resolvedTenant({ resolver: options.resolveTenant, headers, params, actor: execution.actor });

  return tenantId === undefined || tenantId === execution.tenantId
    ? execution
    : executionOfRequest({ correlationId, headers, principal, deadline, tenantId });
}

function deadlineOf(options: ExecuteOptions): Date | undefined {
  if (options.requestTimeoutMs === undefined) {
    return undefined;
  }

  const arrivedAt = options.clock?.now() ?? new Date();

  return new Date(arrivedAt.getTime() + options.requestTimeoutMs);
}

function answer(result: RouteOutput, call: Call): RouteResponse {
  return {
    status: result.status,
    headers: {
      ...defaultContentType(result.body),
      ...lowerCaseKeys(result.headers ?? {}),
      ...identifierHeaders(call),
    },
    ...(result.body === undefined ? {} : { body: result.body }),
  };
}

function defaultContentType(body: unknown): Record<string, string> {
  if (body === undefined) {
    return {};
  }

  return { 'content-type': body instanceof Uint8Array ? 'application/octet-stream' : JSON_CONTENT_TYPE };
}

function lowerCaseKeys(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}

function identifierHeaders({ requestId, correlationId }: Call): Record<string, string> {
  return { 'x-request-id': requestId, [CORRELATION_HEADER]: correlationId };
}

function refusal(error: unknown, call: Call): RouteResponse {
  const { route, options, requestId, correlationId } = call;
  const { execution } = call.reached;
  const problem = toProblem(error, options.errorMapper ?? defaultErrorMapper, requestId);

  notify(options, error, {
    requestId,
    correlationId,
    operationId: route.operationId,
    method: route.method,
    path: route.path,
    problem,
    ...(execution === undefined ? {} : { execution }),
  });

  return {
    status: problem.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...identifierHeaders(call) },
    body: problem,
  };
}

function notify(options: ExecuteOptions, error: unknown, context: ErrorContext): void {
  try {
    options.onError?.(error, context);
  } catch {
    // A failing logger must not turn an answered request into a crash.
  }
}
