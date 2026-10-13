import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';
import type { Route } from '../route/route.js';
import type { Documenting } from './documenting.js';
import { openApiPath } from './open-api-path.js';
import { pathParameters } from './path-parameters.js';
import { requirement } from './requirement.js';
import { responses } from './responses.js';
import { schemaParameters } from './schema-parameters.js';

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
  ];

  return {
    operationId: route.operationId,
    summary: route.summary,
    ...(route.description === undefined ? {} : { description: route.description }),
    ...(route.tags === undefined ? {} : { tags: [...route.tags] }),
    ...(route.deprecated === true ? { deprecated: true } : {}),
    security: route.security === false ? [] : requirement(route.security),
    ...(parameters.length === 0 ? {} : { parameters }),
    ...(request.body === undefined ? {} : { requestBody: requestBody(route, request.body, documenting) }),
    responses: responses(route, documenting),
  };
}

/** The body in JSON, and in every media type the route reads it in besides. */
function requestBody(route: Route, body: Schema<unknown>, { definitions }: Documenting): JsonSchema {
  const schema = definitions.embed(body);
  const mediaTypes = ['application/json', ...(route.consumes ?? [])];

  return { required: true, content: Object.fromEntries(mediaTypes.map((mediaType) => [mediaType, { schema }])) };
}
