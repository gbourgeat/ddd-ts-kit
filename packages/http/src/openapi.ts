import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';
import {
  assertUniqueRoutes,
  createErrorMapper,
  statusTitle,
  type ErrorMapper,
  type HttpMethod,
  type ResponseSpec,
  type Route,
} from './index.js';

export interface OpenApiInfo {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
}

export interface OpenApiServer {
  readonly url: string;
  readonly description?: string;
}

export interface GenerateOpenApiOptions {
  readonly info: OpenApiInfo;
  readonly servers?: readonly OpenApiServer[];
  readonly routes: readonly Route[];
  readonly securitySchemes?: Readonly<Record<string, JsonSchema>>;
  /**
   * The document-wide default requirement. Every route declares its own `security`, which
   * overrides it in each operation: it only speaks to readers of the document as a whole.
   */
  readonly security?: readonly string[];
  /** Must be the mapper the server runs with, or the documented statuses lie. */
  readonly errorMapper?: ErrorMapper;
}

export interface OpenApiDocument {
  readonly openapi: '3.1.0';
  readonly info: OpenApiInfo;
  readonly servers?: readonly OpenApiServer[];
  readonly tags?: readonly { readonly name: string }[];
  readonly security?: readonly Record<string, string[]>[];
  readonly paths: Record<string, Record<string, JsonSchema>>;
  readonly components: {
    readonly schemas: Record<string, JsonSchema>;
    readonly securitySchemes?: Record<string, JsonSchema>;
  };
}

const VALIDATION_FAILED = 'VALIDATION_FAILED';
const PROBLEM_REF = { $ref: '#/components/schemas/Problem' };

// The order OpenAPI tooling conventionally prints operations in.
const METHOD_ORDER: readonly HttpMethod[] = ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];

const PROBLEM_SCHEMA: JsonSchema = {
  type: 'object',
  description: 'Problem details (RFC 9457) with a stable machine-readable code.',
  required: ['type', 'title', 'status', 'code', 'requestId'],
  properties: {
    type: { type: 'string', description: 'URI identifying the kind of problem.' },
    title: { type: 'string' },
    status: { type: 'integer' },
    code: { type: 'string', description: 'Stable error code; branch on this, not on the title.' },
    detail: { type: 'string' },
    issues: {
      type: 'array',
      description: 'Present when the request failed validation.',
      items: {
        type: 'object',
        required: ['path', 'code', 'message'],
        properties: {
          path: { type: 'string', description: 'Dotted path, for example body.items.0.sku.' },
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    requestId: { type: 'string' },
  },
};

export function generateOpenApi(options: GenerateOpenApiOptions): OpenApiDocument {
  assertUniqueRoutes(options.routes);
  const definitions = new Definitions();
  const routes = sortedRoutes(options.routes);
  const paths = pathItems(routes, options.errorMapper ?? createErrorMapper(), definitions);
  const tags = [...new Set(routes.flatMap((route) => route.tags ?? []))].sort(compare);
  const securitySchemes = options.securitySchemes;

  return {
    openapi: '3.1.0',
    info: {
      title: options.info.title,
      version: options.info.version,
      ...(options.info.description === undefined ? {} : { description: options.info.description }),
    },
    ...(options.servers === undefined ? {} : { servers: options.servers }),
    ...(tags.length === 0 ? {} : { tags: tags.map((name) => ({ name })) }),
    ...(options.security === undefined ? {} : { security: requirement(options.security) }),
    paths,
    components: {
      schemas: sortKeys({ ...definitions.all(), Problem: PROBLEM_SCHEMA }),
      ...(securitySchemes === undefined ? {} : { securitySchemes: sortKeys(securitySchemes) }),
    },
  };
}

/** The exact bytes to commit: two-space JSON and a trailing newline. */
export function stringifyOpenApi(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Compares the generated contract with the committed one, ignoring line-ending style. */
export function checkOpenApiDrift(
  document: OpenApiDocument,
  existingFileContent: string,
): { drift: boolean } {
  return { drift: stringifyOpenApi(document) !== existingFileContent.replaceAll('\r\n', '\n') };
}

/** Sorting first makes every later decision (component naming included) order independent. */
function sortedRoutes(routes: readonly Route[]): Route[] {
  return [...routes].sort(
    (a, b) =>
      compare(openApiPath(a.path), openApiPath(b.path)) ||
      METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
  );
}

function pathItems(
  routes: readonly Route[],
  mapper: ErrorMapper,
  definitions: Definitions,
): Record<string, Record<string, JsonSchema>> {
  const paths: Record<string, Record<string, JsonSchema>> = {};
  for (const route of routes) {
    const item = (paths[openApiPath(route.path)] ??= {});
    item[route.method.toLowerCase()] = operation(route, mapper, definitions);
  }
  return paths;
}

function operation(route: Route, mapper: ErrorMapper, definitions: Definitions): JsonSchema {
  const request = route.request ?? {};
  const parameters = [
    ...pathParameters(route.path, request.params, definitions),
    ...schemaParameters('query', request.query, definitions),
    ...schemaParameters('header', request.headers, definitions),
  ];
  return {
    operationId: route.operationId,
    summary: route.summary,
    ...(route.description === undefined ? {} : { description: route.description }),
    ...(route.tags === undefined ? {} : { tags: [...route.tags] }),
    ...(route.deprecated === true ? { deprecated: true } : {}),
    security: route.security === false ? [] : requirement(route.security),
    ...(parameters.length === 0 ? {} : { parameters }),
    ...(request.body === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: definitions.embed(request.body) } },
          },
        }),
    responses: responses(route, mapper, definitions),
  };
}

function responses(route: Route, mapper: ErrorMapper, definitions: Definitions): JsonSchema {
  const byStatus = declaredResponses(route, definitions);
  for (const [status, codes] of errorCodesByStatus(route, mapper)) {
    byStatus.set(status, problemResponse(status, codes, byStatus.get(status)));
  }
  const statuses = [...byStatus.keys()].sort((a, b) => a - b);
  return Object.fromEntries(statuses.map((status) => [String(status), byStatus.get(status)]));
}

function declaredResponses(route: Route, definitions: Definitions): Map<number, JsonSchema> {
  const byStatus = new Map<number, JsonSchema>();
  // A copy has a string index, which is how the statuses are enumerated.
  const declaredByKey: Readonly<Record<string, ResponseSpec>> = { ...route.responses };
  for (const [key, declared] of Object.entries(declaredByKey)) {
    byStatus.set(Number(key), {
      description: declared.description,
      ...(declared.body === undefined
        ? {}
        : { content: { 'application/json': { schema: definitions.embed(declared.body) } } }),
    });
  }
  return byStatus;
}

function errorCodesByStatus(route: Route, mapper: ErrorMapper): Map<number, string[]> {
  const validatesInput = Object.values(route.request ?? {}).some((schema) => schema !== undefined);
  const codes = new Set([...(route.errors ?? []), ...(validatesInput ? [VALIDATION_FAILED] : [])]);
  const codesByStatus = new Map<number, string[]>();
  for (const code of codes) {
    const status = mapper.statusOf(code);
    codesByStatus.set(status, [...(codesByStatus.get(status) ?? []), code]);
  }
  return codesByStatus;
}

function problemResponse(
  status: number,
  codes: readonly string[],
  declared: JsonSchema | undefined,
): JsonSchema {
  const sorted = [...codes].sort(compare);
  return {
    description:
      declared === undefined
        ? `${statusTitle(status)}. Error codes: ${sorted.join(', ')}.`
        : declared['description'],
    content: {
      ...(isRecord(declared?.['content']) ? declared['content'] : {}),
      'application/problem+json': { schema: PROBLEM_REF },
    },
    'x-error-codes': sorted,
  };
}

function pathParameters(
  path: string,
  schema: Schema<unknown> | undefined,
  definitions: Definitions,
): JsonSchema[] {
  const described = new Map(
    schemaParameters('path', schema, definitions).map((parameter) => [parameter['name'], parameter]),
  );
  // The path is the authority on which parameters exist; the schema only refines their type.
  return [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => ({
    name: match[1],
    in: 'path',
    schema: { type: 'string' },
    ...described.get(match[1]),
    required: true,
  }));
}

function schemaParameters(
  location: 'path' | 'query' | 'header',
  schema: Schema<unknown> | undefined,
  definitions: Definitions,
): JsonSchema[] {
  if (schema === undefined) {
    return [];
  }
  const embedded = definitions.embed(schema);
  const properties = embedded['properties'];
  if (!isRecord(properties)) {
    return [];
  }
  const required = Array.isArray(embedded['required']) ? embedded['required'] : [];
  return Object.entries(properties).map(([name, property]) => {
    const description = isRecord(property) ? property['description'] : undefined;
    return {
      name,
      in: location,
      ...(typeof description === 'string' ? { description } : {}),
      required: required.includes(name),
      schema: property,
    };
  });
}

function requirement(schemes: readonly string[]): Record<string, string[]>[] {
  return schemes.map((scheme) => ({ [scheme]: [] }));
}

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
}

/**
 * Local definitions (`$defs`) of the embedded JSON Schemas are moved to `components.schemas`,
 * because a `#/$defs/...` pointer means nothing once the schema sits inside a document.
 */
class Definitions {
  private readonly schemas = new Map<string, JsonSchema>();
  private readonly sources = new Map<string, string>();

  embed(schema: Schema<unknown>): JsonSchema {
    const { $schema: _dialect, $defs, definitions, ...rest } = schema.toJsonSchema();
    const local = { ...(isRecord(definitions) ? definitions : {}), ...(isRecord($defs) ? $defs : {}) };
    const names = new Map<string, string>();
    for (const name of Object.keys(local).sort(compare)) {
      names.set(name, this.reserve(name, JSON.stringify(local[name])));
    }
    for (const [name, component] of names) {
      if (!this.schemas.has(component)) {
        this.schemas.set(component, asSchema(rewriteRefs(local[name], names)));
      }
    }
    return asSchema(rewriteRefs(rest, names));
  }

  all(): Record<string, JsonSchema> {
    return Object.fromEntries(this.schemas);
  }

  /** Two different definitions sharing a name get distinct component names. */
  private reserve(name: string, source: string): string {
    for (let attempt = 1; ; attempt += 1) {
      const candidate = attempt === 1 ? name : `${name}_${attempt}`;
      const known = candidate === 'Problem' ? '' : this.sources.get(candidate);
      if (known === undefined) {
        this.sources.set(candidate, source);
        return candidate;
      }
      if (known === source) {
        return candidate;
      }
    }
  }
}

function rewriteRefs(node: unknown, names: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteRefs(item, names));
  }
  if (!isRecord(node)) {
    return node;
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      if (key === '$ref' && typeof value === 'string') {
        const local = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(value);
        const component = local?.[1] === undefined ? undefined : names.get(local[1]);
        return [key, component === undefined ? value : `#/components/schemas/${component}`];
      }
      return [key, rewriteRefs(value, names)];
    }),
  );
}

function asSchema(node: unknown): JsonSchema {
  return isRecord(node) ? node : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortKeys<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => compare(a, b)));
}

// Code-unit order, not locale order: the output must not depend on the machine's locale.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
