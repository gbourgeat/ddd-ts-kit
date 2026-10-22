import { DuplicateRouteError } from './duplicate-route-error';
import type { RouteSpec } from './route-spec';
import type { Route } from './route';

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
