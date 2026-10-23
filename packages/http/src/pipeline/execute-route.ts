import { Readable } from 'node:stream';
import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import { createErrorMapper } from '../error/create-error-mapper';
import { toProblem } from '../error/to-problem';
import type { Problem } from '../error/problem';
import { assertWritable } from '../field-access/assert-writable';
import { fieldAccess } from '../field-access/field-access';
import { FieldJudge } from '../field-access/field-judge';
import { FieldTree } from '../field-access/field-tree';
import { visibleBody } from '../field-access/visible-body';
import { NotAcceptableError } from '../representation/not-acceptable-error';
import { PROBLEM_SHAPE } from '../representation/problem-shape';
import type { RequestContext } from '../route/request-context';
import type { RouteInput } from '../route/route-input';
import type { RouteOutput } from '../route/route-output';
import type { Route } from '../route/route';
import { isAsyncIterable } from '../support/is-async-iterable';
import { resolvedTenant } from '../tenancy/resolved-tenant';
import { guardRefusals } from '../controller/guard-refusals';
import { admittedCaller } from './admitted-caller';
import { assertDeclaredResponse } from './assert-declared-response';
import { cacheHeadersOf } from './cache-headers-of';
import { conditionalAnswer } from './conditional-answer';
import { CORRELATION_HEADER } from './correlation-header';
import { correlationIdOf } from './correlation-id-of';
import { deadlineOf } from './deadline-of';
import type { ErrorContext } from './error-context';
import type { ExecuteOptions } from './execute-options';
import { executionOfRequest } from './execution-of-request';
import { expectedVersionOf } from './expected-version-of';
import { iteratedWithin, type Within } from './iterated-within';
import { negotiatedVary } from './negotiated-vary';
import { negotiation, type Negotiation } from './negotiation';
import type { RawRequest } from './raw-request';
import { readBody } from './read-body';
import { receiveUpload } from './receive-upload';
import type { RepresentedAnswer } from './represented-answer';
import { represented } from './represented';
import { reportedStream } from './reported-stream';
import type { RouteResponse } from './route-response';
import { taggedAnswer, type Tagging } from './tagged-answer';
import { validateRequest } from './validate-request';
import { wellFormedIdentifier } from './well-formed-identifier';
import { writtenIn } from './written-in';

interface Call {
  readonly route: Route;
  readonly request: RawRequest;
  readonly options: ExecuteOptions;
  readonly requestId: string;
  readonly correlationId: string;
  /** Present when the application registers representations: what the `Accept` header chose. */
  readonly negotiated: Negotiation | undefined;
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
  const { representations } = options;
  const negotiated = representations === undefined ? undefined : negotiation(route, request.headers, representations);
  const call: Call = { route, request, options, requestId, correlationId, negotiated, reached: {} };
  const respond = (): Promise<RouteResponse> => responded(call);

  return options.around === undefined ? respond() : options.around(route, respond);
}

async function responded(call: Call): Promise<RouteResponse> {
  try {
    const result = await handled(call);
    const tagged = taggedAnswer(await answer(result, call), taggingOf(call, result.body));

    return await conditionalAnswer(call.route, call.request.headers, { response: tagged, value: result.body });
  } catch (error) {
    const { response, context } = refusal(error, call);

    await reportGuardRefusal(call.options, error, context);

    return response;
  }
}

/** The tags are read from the value the handler answered, whatever representation writes it. */
function taggingOf({ route, options, reached }: Call, body: unknown): Tagging {
  const perTenant = options.cacheTags?.perTenant === true;
  const tenantId = perTenant ? reached.execution?.tenantId : undefined;

  return { route, header: options.cacheTags?.header, perTenant, params: reached.params, body, tenantId };
}

function defaultRequestId(request: RawRequest): string {
  return wellFormedIdentifier(request.headers['x-request-id']) ?? globalThis.crypto.randomUUID();
}

async function handled(call: Call): Promise<RouteOutput> {
  const { route, request, options } = call;
  const principal = await options.resolvePrincipal?.(request.raw);

  await admittedCaller({
    route,
    headers: request.headers,
    correlationId: call.correlationId,
    principal,
    deadline: deadlineOf(options),
    reached: call.reached,
  });

  const input = await acceptedInput(call);
  const expectedVersion = expectedVersionOf(route, request.headers);
  const execution = executionOf(call, principal, input.params);
  // A field set in a body is an act, recorded; a field shown or left out of the answer only shapes it.
  const setting = new FieldJudge(execution.actor, options.fieldAccess, true);
  const showing = new FieldJudge(execution.actor, options.fieldAccess);
  const context = requestContext(call, { execution, principal, expectedVersion });

  call.reached.params = input.params;

  const within: Within = (work) => {
    const asPrincipal = (): ReturnType<typeof work> => options.withPrincipal?.(principal, work) ?? work();

    return options.executionScope?.run(execution, asPrincipal) ?? asPrincipal();
  };

  // The fields are decided in the scope of the request too: a decision is recorded with who asked and under which correlation.
  const result = await within(async () => {
    await assertWritable(input.body, FieldTree.of(fieldAccess.of(route.request?.body)), setting);

    return visibleOutput(route, await answered(call, { ...input, context }), showing);
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

/** What the context of a request is made of once its caller and its tenant are known. */
interface Reached {
  readonly execution: ExecutionContext;
  readonly principal: unknown;
  readonly expectedVersion: number | undefined;
}

function requestContext(
  { request, requestId, route }: Call,
  { execution, principal, expectedVersion }: Reached,
): RequestContext {
  return {
    requestId,
    execution,
    raw: request.raw,
    rawHeaders: request.headers,
    ...(principal === undefined ? {} : { principal }),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
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

async function answer(result: RouteOutput, call: Call): Promise<RouteResponse> {
  const chosen = call.negotiated?.answer;

  const written = reportingFailures(
    chosen === undefined ? asItIs(result) : await represented(call.route, result, chosen),
    call,
  );

  const kept = {
    ...cacheHeadersOf(call.route, result.status, call.options.resolveTenant?.headers),
    ...lowerCaseKeys(result.headers ?? {}),
  };

  return {
    ...written,
    status: result.status,
    headers: {
      ...defaultContentType(result.body),
      ...written.headers,
      ...kept,
      ...negotiatedVary(call.negotiated?.varies === true, kept['vary']),
      ...identifierHeaders(call),
    },
  };
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
  const kept = { ...cacheHeadersOf(call.route, problem.status), ...identifierHeaders(call) };

  if (chosen === undefined) {
    return { headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...kept }, body: problem };
  }

  const written = writtenIn(problem, chosen, PROBLEM_SHAPE);

  return { ...written, headers: { ...written.headers, ...kept } };
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
