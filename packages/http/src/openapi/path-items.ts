import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { Route } from '../route/route';
import type { Documenting } from './documenting';
import { cacheTagsExtension } from './cache-tags-extension';
import { conditionalParameters } from './conditional-parameters';
import { openApiPath } from './open-api-path';
import { pathParameters } from './path-parameters';
import { requestBody } from './request-body';
import { requirement } from './requirement';
import { responses } from './responses';
import { schemaParameters } from './schema-parameters';

/** The `paths` of the document: one item per path, one operation per method. */
export function pathItems(
  routes: readonly Route[],
  documenting: Documenting,
): Record<string, Record<string, JsonSchema>> {
  const paths = new Map<string, Map<string, JsonSchema>>();

  for (const route of routes) {
    const path = openApiPath(route.path);
    const item = paths.get(path) ?? new Map<string, JsonSchema>();

    item.set(route.method.toLowerCase(), operation(route, documenting));
    paths.set(path, item);
  }

  return Object.fromEntries([...paths].map(([path, item]) => [path, Object.fromEntries(item)]));
}

function operation(route: Route, documenting: Documenting): JsonSchema {
  const request = route.request ?? {};
  const { definitions } = documenting;

  const parameters = [
    ...pathParameters(route.path, request.params, definitions),
    ...schemaParameters('query', request.query, definitions),
    ...schemaParameters('header', request.headers, definitions),
    ...conditionalParameters(route),
  ];

  return {
    operationId: route.operationId,
    summary: route.summary,
    ...(route.description === undefined ? {} : { description: route.description }),
    ...(route.tags === undefined ? {} : { tags: [...route.tags] }),
    ...(route.deprecated === true ? { deprecated: true } : {}),
    security: route.security === false ? [] : requirement(route.security),
    ...(parameters.length === 0 ? {} : { parameters }),
    ...bodyOf(route, documenting),
    responses: responses(route, documenting),
    ...cacheTagsExtension(route),
  };
}

function bodyOf(route: Route, documenting: Documenting): { requestBody?: JsonSchema } {
  const body = requestBody(route, documenting);

  return body === undefined ? {} : { requestBody: body };
}
