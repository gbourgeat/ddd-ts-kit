import type { Route } from '../route/route.js';
import type { RouteResponse } from './route-response.js';

/** What observes a request from outside: it is told the route that was matched and must answer what `respond` answers. */
export type RouteAround = (
  route: Pick<Route, 'method' | 'path' | 'operationId'>,
  respond: () => Promise<RouteResponse>,
) => Promise<RouteResponse>;
