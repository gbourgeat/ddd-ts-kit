import type { IRouter, Request, Response } from 'express';
import type { ExecuteOptions } from '../pipeline/execute-options.js';
import { assertCachedRoutes } from '../pipeline/assert-cached-routes.js';
import { executeRoute } from '../pipeline/execute-route.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { HttpMethod } from '../route/http-method.js';
import type { Route } from '../route/route.js';

export type ExpressMountOptions = ExecuteOptions;

type ExpressHandler = (request: Request, response: Response) => Promise<void>;

type Registrar = Record<HttpMethod, (path: string, handler: ExpressHandler) => void>;

/**
 * Registers the routes on an Express 5 application or router. A JSON body parser
 * (`express.json()`) must be installed before, otherwise bodies reach validation as `undefined`.
 */
export function mountExpress(target: IRouter, routes: readonly Route[], options: ExpressMountOptions = {}): void {
  assertUniqueRoutes(routes);
  assertCachedRoutes(routes, options);

  const register = registrarOf(target);

  for (const route of routes) {
    register[route.method](route.path, handlerOf(route, options));
  }
}

function registrarOf(target: IRouter): Registrar {
  return {
    GET: (path, handler) => target.get(path, handler),
    POST: (path, handler) => target.post(path, handler),
    PUT: (path, handler) => target.put(path, handler),
    PATCH: (path, handler) => target.patch(path, handler),
    DELETE: (path, handler) => target.delete(path, handler),
    HEAD: (path, handler) => target.head(path, handler),
    OPTIONS: (path, handler) => target.options(path, handler),
  };
}

function handlerOf(route: Route, options: ExpressMountOptions): ExpressHandler {
  return async (request, response) => {
    const { params, query, headers } = request;
    const body: unknown = request.body;
    const result = await executeRoute(route, { params, query, headers, body, raw: request }, options);

    response.status(result.status);

    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value);
    }

    response.end(serializeBody(result));
  };
}
