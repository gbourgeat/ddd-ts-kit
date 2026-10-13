import type { JsonSchema } from '@ddd-ts-kit/validation';
import { createErrorMapper } from '../error/create-error-mapper.js';
import type { ErrorMapper } from '../error/error-mapper.js';
import type { Representations } from '../representation/representations.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { HttpMethod } from '../route/http-method.js';
import type { Route } from '../route/route.js';
import { compare } from './compare.js';
import { Definitions } from './definitions.js';
import type { OpenApiDocument } from './open-api-document.js';
import type { OpenApiInfo } from './open-api-info.js';
import { openApiPath } from './open-api-path.js';
import type { OpenApiServer } from './open-api-server.js';
import { pathItems } from './path-items.js';
import { PROBLEM_SCHEMA } from './problem-schema.js';
import { requirement } from './requirement.js';

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
  /**
   * Must be the representations the server is mounted with: they say the media types of each
   * answer, the problem type of each one, and that a request may be refused 406 or 415. Left out,
   * as the server without them, every answer is documented in JSON only.
   */
  readonly representations?: Representations;
}

// The order OpenAPI tooling conventionally prints operations in.
const METHOD_ORDER: readonly HttpMethod[] = ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];

export function generateOpenApi(options: GenerateOpenApiOptions): OpenApiDocument {
  assertUniqueRoutes(options.routes);

  const definitions = new Definitions();
  const routes = sortedRoutes(options.routes);

  const paths = pathItems(routes, {
    mapper: options.errorMapper ?? createErrorMapper(),
    definitions,
    representations: options.representations,
  });

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

/** Sorting first makes every later decision (component naming included) order independent. */
function sortedRoutes(routes: readonly Route[]): Route[] {
  return [...routes].sort(
    (a, b) =>
      compare(openApiPath(a.path), openApiPath(b.path)) ||
      METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
  );
}

function sortKeys<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => compare(a, b)));
}
