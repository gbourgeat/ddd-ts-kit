import { DomainError, type Clock, type ExecutionContext, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { ValidationError, type Schema, type ValidationIssue } from '@ddd-ts-kit/validation';
import {
  CORRELATION_HEADER,
  correlationIdOf,
  executionOfRequest,
  wellFormedIdentifier,
} from './execution.js';

export { CORRELATION_HEADER } from './execution.js';
export {
  pageQuerySchema,
  pageRequestFrom,
  pageRequestParameters,
  pageResponse,
  pageSchemaOf,
  type PageBody,
  type PageQueryOptions,
} from './pagination.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestSchemas {
  readonly params?: Schema<unknown>;
  readonly query?: Schema<unknown>;
  readonly headers?: Schema<unknown>;
  readonly body?: Schema<unknown>;
}

export interface ResponseSpec {
  readonly description: string;
  readonly body?: Schema<unknown>;
}

export interface ResponsesSpec {
  readonly [status: number]: ResponseSpec;
}

export interface RouteSpec<
  Request extends RequestSchemas = RequestSchemas,
  Responses extends ResponsesSpec = ResponsesSpec,
> {
  readonly method: HttpMethod;
  /** Express-style path: literal segments and `:name` parameters, for example `/orders/:orderId`. */
  readonly path: string;
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly request?: Request;
  readonly responses: Responses;
  /** Domain error codes this route may answer; they are documented in the contract. */
  readonly errors?: readonly string[];
  /**
   * Names of the security schemes that apply, or `false` for a route anybody may call. Required:
   * a route is never public by omission. An empty list is refused, it would say the same as `false`.
   */
  readonly security: readonly string[] | false;
  readonly deprecated?: boolean;
}

export interface RequestContext {
  readonly requestId: string;
  /**
   * What this request carries for everything it causes: correlation id, actor, session, locale,
   * deadline, origin `http`. The same object the execution scope runs the handler in.
   */
  readonly execution: ExecutionContext;
  readonly principal?: unknown;
  /** The framework's own request object, for the rare case the neutral input is not enough. */
  readonly raw: unknown;
}

export type RawHeaders = Record<string, string | string[] | undefined>;

interface PartDefaults {
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: RawHeaders;
  body: unknown;
}

type PartOf<Request, Part extends keyof PartDefaults> = Request extends {
  readonly [K in Part]: Schema<infer T>;
}
  ? T
  : PartDefaults[Part];

/** What a handler receives: each part has the type its schema produces. */
export interface HandlerInput<Request extends RequestSchemas = RequestSchemas> {
  readonly params: PartOf<Request, 'params'>;
  readonly query: PartOf<Request, 'query'>;
  readonly headers: PartOf<Request, 'headers'>;
  readonly body: PartOf<Request, 'body'>;
  readonly context: RequestContext;
}

type StatusOf<Key> = Key extends number
  ? Key
  : Key extends `${infer Status extends number}`
    ? Status
    : never;

type ResultFor<Status, Spec> = Spec extends { readonly body: Schema<infer T> }
  ? { readonly status: StatusOf<Status>; readonly body: T; readonly headers?: Record<string, string> }
  : { readonly status: StatusOf<Status>; readonly body?: undefined; readonly headers?: Record<string, string> };

/** What a handler returns: one of the declared statuses, with the body its schema describes. */
export type HandlerResult<Responses extends ResponsesSpec = ResponsesSpec> = {
  [Status in keyof Responses]: ResultFor<Status, Responses[Status]>;
}[keyof Responses];

export type RouteHandler<
  Request extends RequestSchemas = RequestSchemas,
  Responses extends ResponsesSpec = ResponsesSpec,
> = (input: HandlerInput<Request>) => HandlerResult<Responses> | Promise<HandlerResult<Responses>>;

/** The handler input once the schema types are erased, as the pipeline sees it. */
export interface RouteInput {
  readonly params: unknown;
  readonly query: unknown;
  readonly headers: unknown;
  readonly body: unknown;
  readonly context: RequestContext;
}

export interface RouteOutput {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * A declared route with its handler. The schema types are erased here so that routes of any
 * shape sit in one list; they are checked where it matters, in `defineRoute`.
 */
export interface Route extends RouteSpec {
  // A method on purpose: a method parameter is compared bivariantly, which is what lets the
  // precisely typed handler be stored without a type assertion.
  handle(input: RouteInput): RouteOutput | Promise<RouteOutput>;
}

const PATH_PATTERN = /^\/$|^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))+$/;

export function defineRoute<
  const Request extends RequestSchemas,
  const Responses extends ResponsesSpec,
>(
  spec: RouteSpec<Request, Responses>,
  handler: RouteHandler<Request, Responses>,
): Route {
  if (!PATH_PATTERN.test(spec.path)) {
    throw new Error(
      `Route "${spec.operationId}": the path "${spec.path}" must be made of literal segments and ":name" parameters.`,
    );
  }
  assertSecurityDeclared(spec);
  return { ...spec, handle: handler };
}

// Checked at run time too: a JavaScript caller, or a spec built dynamically, gets no compile error.
function assertSecurityDeclared(spec: Pick<RouteSpec, 'operationId'> & { readonly security?: unknown }): void {
  const { security } = spec;
  if (security === false || (Array.isArray(security) && security.length > 0)) return;
  throw new Error(
    `Route "${spec.operationId}": declare "security" with the names of its security schemes, or false for a public route.`,
  );
}

export class DuplicateRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRouteError';
  }
}

export function assertUniqueRoutes(routes: readonly Route[]): void {
  const operationIds = new Set<string>();
  const endpoints = new Map<string, string>();
  for (const route of routes) {
    if (operationIds.has(route.operationId)) {
      throw new DuplicateRouteError(`Duplicate operationId "${route.operationId}".`);
    }
    operationIds.add(route.operationId);
    const key = routeKey(route);
    const other = endpoints.get(key);
    if (other !== undefined) {
      throw new DuplicateRouteError(
        `"${route.operationId}" and "${other}" both declare ${route.method} ${route.path}.`,
      );
    }
    endpoints.set(key, route.operationId);
  }
}

/** `/orders/:orderId` and `/orders/:id` are the same endpoint for a router. */
function routeKey(route: RouteSpec): string {
  return `${route.method} ${route.path.replace(/:[^/]+/g, ':')}`;
}

/** Gathers routes (or groups of routes) into one list and refuses duplicates. */
export function defineRoutes(...routes: readonly (Route | readonly Route[])[]): readonly Route[] {
  const flat = routes.flatMap((entry): readonly Route[] => (isRouteList(entry) ? entry : [entry]));
  assertUniqueRoutes(flat);
  return flat;
}

function isRouteList(entry: Route | readonly Route[]): entry is readonly Route[] {
  return Array.isArray(entry);
}

/** Returns the same routes under a path prefix, for the server and for the contract alike. */
export function prefixRoutes(prefix: string, routes: readonly Route[]): readonly Route[] {
  const base = prefix.replace(/\/+$/, '');
  return routes.map((route) => ({
    ...route,
    path: route.path === '/' ? (base === '' ? '/' : base) : `${base}${route.path}`,
  }));
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

/** Domain error `code` to HTTP status. */
export type ErrorMapping = Readonly<Record<string, number>>;

export const DEFAULT_ERROR_MAPPING: ErrorMapping = {
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVARIANT_VIOLATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
};

export interface ErrorMapperOptions {
  /** Status of a `DomainError` whose code is not mapped. Defaults to 422. */
  readonly fallbackStatus?: number;
  /** Builds the problem `type` URI of a code. Defaults to `urn:problem:<code-in-kebab-case>`. */
  readonly typeOf?: (code: string) => string;
}

export interface ErrorMapper {
  readonly mapping: ErrorMapping;
  statusOf(code: string): number;
  typeOf(code: string): string;
}

export function createErrorMapper(
  overrides: ErrorMapping = {},
  options: ErrorMapperOptions = {},
): ErrorMapper {
  const mapping: ErrorMapping = { ...DEFAULT_ERROR_MAPPING, ...overrides };
  const fallbackStatus = options.fallbackStatus ?? 422;
  const typeOf =
    options.typeOf ?? ((code: string) => `urn:problem:${code.toLowerCase().replaceAll('_', '-')}`);
  return {
    mapping,
    statusOf: (code) => mapping[code] ?? fallbackStatus,
    typeOf,
  };
}

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly issues?: readonly ValidationIssue[];
  readonly requestId: string;
}

const STATUS_TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  412: 'Precondition Failed',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  423: 'Locked',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function statusTitle(status: number): string {
  return STATUS_TITLES[status] ?? (status >= 500 ? 'Server Error' : 'Client Error');
}

export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

export function toProblem(error: unknown, mapper: ErrorMapper, requestId: string): Problem {
  if (!(error instanceof DomainError)) {
    return internalProblem(requestId);
  }
  const status = mapper.statusOf(error.code);
  if (status >= 500) {
    // A domain error mapped to a server fault is no longer the client's business.
    return { ...internalProblem(requestId), status, title: statusTitle(status), code: error.code };
  }
  return {
    type: mapper.typeOf(error.code),
    title: statusTitle(status),
    status,
    code: error.code,
    detail: error.message,
    ...(error instanceof ValidationError ? { issues: error.issues } : {}),
    requestId,
  };
}

// The message of an unexpected error quotes data and internals: it never leaves the process.
function internalProblem(requestId: string): Problem {
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: INTERNAL_ERROR_CODE,
    requestId,
  };
}

/** What an adapter extracts from its framework before handing over to `executeRoute`. */
export interface RawRequest {
  readonly params: unknown;
  readonly query: unknown;
  readonly headers: RawHeaders;
  readonly body: unknown;
  readonly raw: unknown;
}

export interface ErrorContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** The response the client receives for this error. */
  readonly problem: Problem;
}

export interface ExecuteOptions {
  readonly errorMapper?: ErrorMapper;
  /** Authenticates the request; throw `UnauthorizedError` to refuse it. */
  readonly resolvePrincipal?: (raw: unknown) => unknown;
  /**
   * Runs every handler inside a scope that knows the principal, typically an ambient actor
   * context, so that no route can forget to open it.
   */
  readonly withPrincipal?: <T>(principal: unknown, work: () => Promise<T>) => Promise<T>;
  /** Called for every error answered as a problem, expected or not. Meant for logging. */
  readonly onError?: (error: unknown, context: ErrorContext) => void;
  /** Checks each response against the route declaration. Meant for tests. */
  readonly validateResponses?: boolean;
  /** Defaults to the incoming `x-request-id` header when it is well formed, else a UUID. */
  readonly requestId?: (request: RawRequest) => string;
  /**
   * Runs every handler inside `scope.run(execution, ...)`, so loggers, audit columns and tenant
   * scoping read the execution context of the request. Opened outside of `withPrincipal`.
   */
  readonly executionScope?: ExecutionScope;
  /**
   * Gives every request a `deadline` in its execution context, this many milliseconds after it
   * arrived. The pipeline does not interrupt a handler: what honours the deadline reads it.
   */
  readonly requestTimeoutMs?: number;
  /** The instant a request arrived at, for `requestTimeoutMs`. Defaults to the system clock. */
  readonly clock?: Clock;
}

export interface RouteResponse {
  readonly status: number;
  /** Lower-case names. `content-type` is set whenever there is a body. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

/** The route answered something its declaration does not allow; reported as a 500. */
export class ResponseContractError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.name = 'ResponseContractError';
    this.issues = issues;
  }
}

const defaultErrorMapper = createErrorMapper();
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

interface Call {
  readonly route: Route;
  readonly request: RawRequest;
  readonly options: ExecuteOptions;
  readonly requestId: string;
  readonly correlationId: string;
}

export async function executeRoute(
  route: Route,
  request: RawRequest,
  options: ExecuteOptions = {},
): Promise<RouteResponse> {
  const requestId = (options.requestId ?? defaultRequestId)(request);
  const correlationId = correlationIdOf(request.headers, requestId);
  const call: Call = { route, request, options, requestId, correlationId };
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
  const { route, request, options, requestId, correlationId } = call;
  const principal = await options.resolvePrincipal?.(request.raw);
  const input = validateRequest(route, request);
  const { headers } = request;
  const execution = executionOfRequest({ correlationId, headers, principal, deadline: deadlineOf(options) });
  const context: RequestContext = {
    requestId,
    execution,
    raw: request.raw,
    ...(principal === undefined ? {} : { principal }),
  };
  const handle = async (): Promise<RouteOutput> => route.handle({ ...input, context });
  const asPrincipal = (): Promise<RouteOutput> => options.withPrincipal?.(principal, handle) ?? handle();
  const result = await (options.executionScope?.run(execution, asPrincipal) ?? asPrincipal());
  if (options.validateResponses === true) {
    assertDeclaredResponse(route, result.status, result.body);
  }
  return result;
}

function deadlineOf(options: ExecuteOptions): Date | undefined {
  if (options.requestTimeoutMs === undefined) return undefined;
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

function identifierHeaders({ requestId, correlationId }: Call): Record<string, string> {
  return { 'x-request-id': requestId, [CORRELATION_HEADER]: correlationId };
}

function refusal(error: unknown, call: Call): RouteResponse {
  const { route, options, requestId, correlationId } = call;
  const problem = toProblem(error, options.errorMapper ?? defaultErrorMapper, requestId);
  notify(options, error, {
    requestId,
    correlationId,
    operationId: route.operationId,
    method: route.method,
    path: route.path,
    problem,
  });
  return {
    status: problem.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE, ...identifierHeaders(call) },
    body: problem,
  };
}

function validateRequest(
  route: Route,
  request: RawRequest,
): { params: unknown; query: unknown; headers: unknown; body: unknown } {
  const issues: ValidationIssue[] = [];
  const parse = (part: 'params' | 'query' | 'headers' | 'body'): unknown => {
    const schema = route.request?.[part];
    if (schema === undefined) {
      return request[part];
    }
    const result = schema.parse(request[part]);
    if (result.ok) {
      return result.value;
    }
    for (const issue of result.error) {
      issues.push({ ...issue, path: issue.path === '' ? part : `${part}.${issue.path}` });
    }
    return undefined;
  };
  const input = {
    params: parse('params'),
    query: parse('query'),
    headers: parse('headers'),
    body: parse('body'),
  };
  if (issues.length > 0) {
    throw new ValidationError(issues, 'The request is not valid.');
  }
  return input;
}

function assertDeclaredResponse(route: Route, status: number, body: unknown): void {
  const declared = route.responses[status];
  if (declared === undefined) {
    throw new ResponseContractError(
      `Route "${route.operationId}" answered ${status}, which it does not declare.`,
    );
  }
  if (declared.body === undefined) {
    if (body !== undefined) {
      throw new ResponseContractError(
        `Route "${route.operationId}" answered ${status} with a body, but declares none.`,
      );
    }
    return;
  }
  const result = declared.body.parse(body);
  if (!result.ok) {
    throw new ResponseContractError(
      `Route "${route.operationId}" answered ${status} with a body that does not match its schema.`,
      result.error,
    );
  }
}

function notify(options: ExecuteOptions, error: unknown, context: ErrorContext): void {
  try {
    options.onError?.(error, context);
  } catch {
    // A failing logger must not turn an answered request into a crash.
  }
}

function lowerCaseKeys(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
}

/**
 * The bytes every adapter writes, so the three frameworks answer identically. A string or
 * binary body is sent as is when the handler chose its own content type; anything else is JSON.
 */
export function serializeBody(response: RouteResponse): string | Uint8Array | undefined {
  const { body } = response;
  if (body === undefined) {
    return undefined;
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  const isJson = /[/+]json\b/.test(response.headers['content-type'] ?? '');
  return typeof body === 'string' && !isJson ? body : JSON.stringify(body);
}
