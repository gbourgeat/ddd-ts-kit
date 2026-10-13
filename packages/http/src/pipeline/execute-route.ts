import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import { createErrorMapper } from '../error/create-error-mapper.js';
import { toProblem } from '../error/to-problem.js';
import type { RequestContext } from '../route/request-context.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { assertDeclaredResponse } from './assert-declared-response.js';
import { cacheHeadersOf } from './cache-headers-of.js';
import { conditionalAnswer } from './conditional-answer.js';
import { CORRELATION_HEADER } from './correlation-header.js';
import { correlationIdOf } from './correlation-id-of.js';
import type { ErrorContext } from './error-context.js';
import type { ExecuteOptions } from './execute-options.js';
import { executionOfRequest } from './execution-of-request.js';
import { expectedVersionOf } from './expected-version-of.js';
import type { RawRequest } from './raw-request.js';
import type { RouteResponse } from './route-response.js';
import { taggedAnswer, type Tagging } from './tagged-answer.js';
import { resolvedTenant } from '../tenancy/resolved-tenant.js';
import { guardRefusals } from '../controller/guard-refusals.js';
import { validateRequest } from './validate-request.js';
import { wellFormedIdentifier } from './well-formed-identifier.js';

interface Call {
  readonly route: Route;
  readonly request: RawRequest;
  readonly options: ExecuteOptions;
  readonly requestId: string;
  readonly correlationId: string;
  /** Filled as the request advances, for the error hook to say how far it went, and for the tags of the answer. */
  readonly reached: { execution?: ExecutionContext; params?: unknown };
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
    const answered = answer(await handled(call), call);
    const tagged = taggedAnswer(answered, taggingOf(call));

    return await conditionalAnswer(call.route, call.request.headers, tagged);
  } catch (error) {
    const { response, context } = refusal(error, call);

    await reportGuardRefusal(call.options, error, context);

    return response;
  }
}

function taggingOf({ route, options, reached }: Call): Tagging {
  const tenantId = options.cacheTags?.perTenant === true ? reached.execution?.tenantId : undefined;

  return { route, header: options.cacheTags?.header, params: reached.params, tenantId };
}

function defaultRequestId(request: RawRequest): string {
  return wellFormedIdentifier(request.headers['x-request-id']) ?? globalThis.crypto.randomUUID();
}

async function handled(call: Call): Promise<RouteOutput> {
  const { route, request, options, requestId } = call;
  const principal = await options.resolvePrincipal?.(request.raw);
  const input = validateRequest(route, request);
  const { headers } = request;
  const expectedVersion = expectedVersionOf(route, headers);
  const execution = executionOf(call, principal, input.params);

  call.reached.params = input.params;

  const context: RequestContext = {
    requestId,
    execution,
    raw: request.raw,
    rawHeaders: headers,
    ...(principal === undefined ? {} : { principal }),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
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
function executionOf(call: Call, principal: unknown, params: unknown): ExecutionContext {
  const { request, options, correlationId } = call;
  const { headers } = request;
  const deadline = deadlineOf(options);
  const execution = executionOfRequest({ correlationId, headers, principal, deadline });

  call.reached.execution = execution;

  const tenantId = resolvedTenant({ resolver: options.resolveTenant, headers, params, actor: execution.actor });
  const named = tenantId === undefined || tenantId === execution.tenantId ? execution : undefined;

  call.reached.execution = named ?? executionOfRequest({ correlationId, headers, principal, deadline, tenantId });

  return call.reached.execution;
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
      ...cacheHeadersOf(call.route, result.status),
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

function refusal(error: unknown, call: Call): { response: RouteResponse; context: ErrorContext } {
  const { route, options, requestId, correlationId } = call;
  const { execution } = call.reached;
  const problem = toProblem(error, options.errorMapper ?? defaultErrorMapper, requestId);

  const context: ErrorContext = {
    requestId,
    correlationId,
    operationId: route.operationId,
    method: route.method,
    path: route.path,
    problem,
    ...(execution === undefined ? {} : { execution }),
  };

  notify(options, error, context);

  const headers = {
    'content-type': PROBLEM_CONTENT_TYPE,
    ...cacheHeadersOf(route, problem.status),
    ...identifierHeaders(call),
  };

  return { response: { status: problem.status, headers, body: problem }, context };
}

async function reportGuardRefusal(options: ExecuteOptions, error: unknown, context: ErrorContext): Promise<void> {
  const { execution } = context;

  if (options.onGuardRefusal === undefined || execution === undefined || !guardRefusals.has(error)) {
    return;
  }

  try {
    await options.onGuardRefusal({ ...context, execution });
  } catch {
    // The request is refused either way: a failing hook must not turn the refusal into a fault.
  }
}

function notify(options: ExecuteOptions, error: unknown, context: ErrorContext): void {
  try {
    options.onError?.(error, context);
  } catch {
    // A failing logger must not turn an answered request into a crash.
  }
}
