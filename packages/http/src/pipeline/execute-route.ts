import { Readable } from 'node:stream';
import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import { createErrorMapper } from '../error/create-error-mapper.js';
import { toProblem } from '../error/to-problem.js';
import type { Problem } from '../error/problem.js';
import { assertWritable } from '../field-access/assert-writable.js';
import { fieldAccess } from '../field-access/field-access.js';
import { FieldJudge } from '../field-access/field-judge.js';
import { FieldTree } from '../field-access/field-tree.js';
import { visibleBody } from '../field-access/visible-body.js';
import { NotAcceptableError } from '../representation/not-acceptable-error.js';
import { PROBLEM_SHAPE } from '../representation/problem-shape.js';
import type { RequestContext } from '../route/request-context.js';
import type { RouteInput } from '../route/route-input.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { isAsyncIterable } from '../support/is-async-iterable.js';
import { resolvedTenant } from '../tenancy/resolved-tenant.js';
import { guardRefusals } from '../controller/guard-refusals.js';
import { assertDeclaredResponse } from './assert-declared-response.js';
import { CORRELATION_HEADER } from './correlation-header.js';
import { correlationIdOf } from './correlation-id-of.js';
import type { ErrorContext } from './error-context.js';
import type { ExecuteOptions } from './execute-options.js';
import { executionOfRequest } from './execution-of-request.js';
import { iteratedWithin, type Within } from './iterated-within.js';
import { negotiation, type Negotiation } from './negotiation.js';
import type { RawRequest } from './raw-request.js';
import { readBody } from './read-body.js';
import { receiveUpload } from './receive-upload.js';
import type { RepresentedAnswer } from './represented-answer.js';
import { represented } from './represented.js';
import { reportedStream } from './reported-stream.js';
import type { RouteResponse } from './route-response.js';
import { validateRequest } from './validate-request.js';
import { wellFormedIdentifier } from './well-formed-identifier.js';
import { writtenIn } from './written-in.js';

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
    const { response, context } = refusal(error, call);

    await reportGuardRefusal(call.options, error, context);

    return response;
  }
}

function defaultRequestId(request: RawRequest): string {
  return wellFormedIdentifier(request.headers['x-request-id']) ?? globalThis.crypto.randomUUID();
}

async function handled(call: Call): Promise<RouteOutput> {
  const { route, request, options } = call;
  const principal = await options.resolvePrincipal?.(request.raw);
  const input = await acceptedInput(call);
  const execution = executionOf(call, principal, input.params);
  const judge = new FieldJudge(execution.actor, options.fieldAccess);
  const context = requestContext(call, execution, principal);

  const within: Within = (work) => {
    const asPrincipal = (): ReturnType<typeof work> => options.withPrincipal?.(principal, work) ?? work();

    return options.executionScope?.run(execution, asPrincipal) ?? asPrincipal();
  };

  // The fields are decided in the scope of the request too: a decision is recorded with who asked and under which correlation.
  const result = await within(async () => {
    await assertWritable(input.body, FieldTree.of(fieldAccess.of(route.request?.body)), judge);

    return visibleOutput(route, await answered(call, { ...input, context }), judge);
  });

  return streamedWithin(result, within);
}

/** What the handler answers, checked against the declaration when the options ask for it. */
async function answered({ route, options }: Call, input: RouteInput): Promise<RouteOutput> {
  const result = await route.handle(input);

  if (options.validateResponses === true) {
    assertDeclaredResponse(route, result);
  }

  return result;
}

/** A list streamed after the handler returned is still read inside the scope of the request; a file is the handler's own. */
function streamedWithin(result: RouteOutput, within: Within): RouteOutput {
  const listed = isAsyncIterable(result.body) && !(result.body instanceof Readable);

  return listed ? { ...result, body: iteratedWithin(result.body, within) } : result;
}

function requestContext(
  { request, requestId, route }: Call,
  execution: ExecutionContext,
  principal: unknown,
): RequestContext {
  return {
    requestId,
    execution,
    raw: request.raw,
    rawHeaders: request.headers,
    ...(principal === undefined ? {} : { principal }),
    ...(route.rawBody === true && request.stream !== undefined ? { stream: request.stream } : {}),
  };
}

/** The answer without the fields its schema reserves to callers this one is not. */
async function visibleOutput(route: Route, result: RouteOutput, judge: FieldJudge): Promise<RouteOutput> {
  const tree = FieldTree.of(fieldAccess.of(route.responses[result.status]?.body));

  return tree.isEmpty() ? result : { ...result, body: await visibleBody(result.body, tree, judge) };
}

/**
 * The parts of the request through their schemas, once the request accepts an answer and its
 * body is read: an upload gives its fields, a body sent in another media type is read by its
 * representation, a raw body is the handler's.
 */
async function acceptedInput(call: Call): Promise<Omit<RouteInput, 'context'>> {
  const { route, request, options, negotiated } = call;
  const received = await receiveUpload(route, request, options);
  const upload = received.upload === undefined ? {} : { upload: received.upload };

  if (negotiated?.refused === true) {
    throw new NotAcceptableError('The route answers in none of the media types the request accepts.');
  }

  const readable = negotiated !== undefined && route.upload === undefined && route.rawBody !== true;
  const read = readable ? readBody(route, received.request, negotiated.representations) : received.request;

  return { ...validateRequest(route, read), ...upload };
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

async function answer(result: RouteOutput, call: Call): Promise<RouteResponse> {
  const chosen = call.negotiated?.answer;

  const written = reportingFailures(
    chosen === undefined ? asItIs(result) : await represented(call.route, result, chosen),
    call,
  );

  const own = lowerCaseKeys(result.headers ?? {});

  return {
    ...written,
    status: result.status,
    headers: {
      ...defaultContentType(result.body),
      ...written.headers,
      ...own,
      ...varyOf(call.negotiated?.varies === true, own['vary']),
      ...identifierHeaders(call),
    },
  };
}

/** `Vary: accept` for an answer negotiated among several media types, added to the one the handler sets. */
function varyOf(varies: boolean, own: string | undefined): Record<string, string> {
  if (!varies) {
    return {};
  }

  const names = (own ?? '').split(',').map((name) => name.trim().toLowerCase());

  if (own === undefined || own.trim() === '') {
    return { vary: 'accept' };
  }

  return names.includes('accept') || names.includes('*') ? {} : { vary: `${own}, accept` };
}

/** A streamed list that fails after its status is told to the error hook, as a fault, before the response is cut short. */
function reportingFailures(written: RepresentedAnswer, call: Call): RepresentedAnswer {
  if (written.stream === undefined) {
    return written;
  }

  const report = (error: unknown): void => {
    notify(call.options, error, { ...contextOf(error, call), interrupted: true });
  };

  return { ...written, stream: reportedStream(written.stream, report) };
}

/** An answer no representation writes: the value of the handler, for the adapter to serialize. */
function asItIs({ body }: RouteOutput): RepresentedAnswer {
  return body === undefined ? { headers: {} } : { headers: {}, body };
}

function defaultContentType(body: unknown): Record<string, string> {
  if (body === undefined) {
    return {};
  }

  const binary = body instanceof Uint8Array || body instanceof Readable;

  return { 'content-type': binary ? 'application/octet-stream' : JSON_CONTENT_TYPE };
}

function lowerCaseKeys(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}

function identifierHeaders({ requestId, correlationId }: Call): Record<string, string> {
  return { 'x-request-id': requestId, [CORRELATION_HEADER]: correlationId };
}

function refusal(error: unknown, call: Call): { response: RouteResponse; context: ErrorContext } {
  const context = contextOf(error, call);
  const { problem } = context;

  notify(call.options, error, context);

  return { response: { status: problem.status, ...problemBody(problem, call) }, context };
}

function contextOf(error: unknown, call: Call): ErrorContext {
  const { route, options, requestId, correlationId } = call;
  const { execution } = call.reached;

  return {
    requestId,
    correlationId,
    operationId: route.operationId,
    method: route.method,
    path: route.path,
    problem: toProblem(error, options.errorMapper ?? defaultErrorMapper, requestId),
    ...(execution === undefined ? {} : { execution }),
  };
}

function problemBody(problem: Problem, call: Call): Omit<RouteResponse, 'status'> {
  const chosen = call.negotiated?.problem;

  if (chosen === undefined) {
    return { headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...identifierHeaders(call) }, body: problem };
  }

  const written = writtenIn(problem, chosen, PROBLEM_SHAPE);

  return { ...written, headers: { ...written.headers, ...identifierHeaders(call) } };
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
