import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { ErrorMapper } from '../error/error-mapper.js';
import type { Route } from '../route/route.js';
import type { Definitions } from './definitions.js';
import { openApiPath } from './open-api-path.js';
import { pathParameters } from './path-parameters.js';
import { requestBody } from './request-body.js';
import { requirement } from './requirement.js';
import { responses } from './responses.js';
import { schemaParameters } from './schema-parameters.js';

/** The `paths` of the document: one item per path, one operation per method. */
export function pathItems(
  routes: readonly Route[],
  mapper: ErrorMapper,
  definitions: Definitions,
): Record<string, Record<string, JsonSchema>> {
  const paths = new Map<string, Map<string, JsonSchema>>();

  for (const route of routes) {
    const path = openApiPath(route.path);
    const item = paths.get(path) ?? new Map<string, JsonSchema>();

    item.set(route.method.toLowerCase(), operation(route, mapper, definitions));
    paths.set(path, item);
  }

  return Object.fromEntries([...paths].map(([path, item]) => [path, Object.fromEntries(item)]));
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
    ...bodyOf(route, definitions),
    responses: responses(route, mapper, definitions),
  };
}

function bodyOf(route: Route, definitions: Definitions): { requestBody?: JsonSchema } {
  const body = requestBody(route, definitions);

  return body === undefined ? {} : { requestBody: body };
}
