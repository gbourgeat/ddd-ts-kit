import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import { createErrorMapper } from '../error/create-error-mapper.js';
import { toProblem } from '../error/to-problem.js';
import type { Problem } from '../error/problem.js';
import { NotAcceptableError } from '../representation/not-acceptable-error.js';
import { PROBLEM_SHAPE } from '../representation/problem-shape.js';
import type { RequestContext } from '../route/request-context.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { assertDeclaredResponse } from './assert-declared-response.js';
import { CORRELATION_HEADER } from './correlation-header.js';
import { correlationIdOf } from './correlation-id-of.js';
import type { ErrorContext } from './error-context.js';
import type { ExecuteOptions } from './execute-options.js';
import { executionOfRequest } from './execution-of-request.js';
import { negotiation, type Negotiation } from './negotiation.js';
import type { RawRequest } from './raw-request.js';
import { readBody } from './read-body.js';
import { represented } from './represented.js';
import type { RouteResponse } from './route-response.js';
import { validateRequest } from './validate-request.js';
import { wellFormedIdentifier } from './well-formed-identifier.js';
import { writtenAs } from './written-as.js';

interface Call {
  readonly route: Route;
  readonly request: RawRequest;
  readonly options: ExecuteOptions;
  readonly requestId: string;
  readonly correlationId: string;
  /** Present when the application registers representations: what the `Accept` header chose. */
  readonly negotiated: Negotiation | undefined;
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
  const { representations } = options;
  const negotiated = representations === undefined ? undefined : negotiation(route, request.headers, representations);
  const call: Call = { route, request, options, requestId, correlationId, negotiated, reached: {} };
  const respond = (): Promise<RouteResponse> => responded(call);

  return options.around === undefined ? respond() : options.around(route, respond);
}

async function responded(call: Call): Promise<RouteResponse> {
  try {
    return await answer(await handled(call), call);
  } catch (error) {
    return refusal(error, call);
  }
}

function defaultRequestId(request: RawRequest): string {
  return wellFormedIdentifier(request.headers['x-request-id']) ?? globalThis.crypto.randomUUID();
}

async function handled(call: Call): Promise<RouteOutput> {
  const { route, request, options, requestId, correlationId } = call;
  const principal = await options.resolvePrincipal?.(request.raw);
  const input = acceptedInput(call);
  const { headers } = request;
  const execution = executionOfRequest({ correlationId, headers, principal, deadline: deadlineOf(options) });

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

/** The parts of the request through their schemas, once the request accepts an answer and its body is read. */
function acceptedInput({ route, request, negotiated }: Call): ReturnType<typeof validateRequest> {
  if (negotiated === undefined) {
    return validateRequest(route, request);
  }

  if (negotiated.answer === undefined) {
    throw new NotAcceptableError('The route answers in none of the media types the request accepts.');
  }

  return validateRequest(route, readBody(route, request, negotiated.representations));
}

function deadlineOf(options: ExecuteOptions): Date | undefined {
  if (options.requestTimeoutMs === undefined) {
    return undefined;
  }

  const arrivedAt = options.clock?.now() ?? new Date();

  return new Date(arrivedAt.getTime() + options.requestTimeoutMs);
}

async function answer(result: RouteOutput, call: Call): Promise<RouteResponse> {
  const chosen = call.negotiated?.answer;

  if (chosen === undefined) {
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

  const written = await represented(call.route, result, chosen);
  const vary = call.negotiated?.varies === true ? { vary: 'accept' } : {};

  return {
    ...written,
    status: result.status,
    headers: {
      ...defaultContentType(result.body),
      ...written.headers,
      ...vary,
      ...lowerCaseKeys(result.headers ?? {}),
      ...identifierHeaders(call),
    },
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

  return { status: problem.status, ...problemBody(problem, call) };
}

function problemBody(problem: Problem, call: Call): Omit<RouteResponse, 'status'> {
  const chosen = call.negotiated?.problem;

  if (chosen === undefined) {
    return { headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...identifierHeaders(call) }, body: problem };
  }

  const written = writtenAs(chosen.representation.write(problem, PROBLEM_SHAPE), chosen.mediaType);

  return { ...written, headers: { ...written.headers, ...identifierHeaders(call) } };
}

function notify(options: ExecuteOptions, error: unknown, context: ErrorContext): void {
  try {
    options.onError?.(error, context);
  } catch {
    // A failing logger must not turn an answered request into a crash.
  }
}
