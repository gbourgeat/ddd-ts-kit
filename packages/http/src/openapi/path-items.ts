import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { ErrorMapper } from '../error/error-mapper.js';
import type { Route } from '../route/route.js';
import type { Definitions } from './definitions.js';
import { openApiPath } from './open-api-path.js';
import { pathParameters } from './path-parameters.js';
import { requirement } from './requirement.js';
import { responses } from './responses.js';
import { schemaParameters } from './schema-parameters.js';

/** The `paths` of the document: one item per path, one operation per method. */
export function pathItems(
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
