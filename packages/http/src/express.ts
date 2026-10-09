import type { IRouter, Request, Response } from 'express';
import {
  assertUniqueRoutes,
  executeRoute,
  serializeBody,
  type ExecuteOptions,
  type HttpMethod,
  type Route,
} from './index.js';

export type ExpressMountOptions = ExecuteOptions;

type ExpressHandler = (request: Request, response: Response) => Promise<void>;

/**
 * Registers the routes on an Express 5 application or router. A JSON body parser
 * (`express.json()`) must be installed before, otherwise bodies reach validation as `undefined`.
 */
export function mountExpress(
  target: IRouter,
  routes: readonly Route[],
  options: ExpressMountOptions = {},
): void {
  assertUniqueRoutes(routes);
  const register: Record<HttpMethod, (path: string, handler: ExpressHandler) => void> = {
    GET: (path, handler) => target.get(path, handler),
    POST: (path, handler) => target.post(path, handler),
    PUT: (path, handler) => target.put(path, handler),
    PATCH: (path, handler) => target.patch(path, handler),
    DELETE: (path, handler) => target.delete(path, handler),
    HEAD: (path, handler) => target.head(path, handler),
    OPTIONS: (path, handler) => target.options(path, handler),
  };
  for (const route of routes) {
    register[route.method](route.path, async (request, response) => {
      const result = await executeRoute(
        route,
        {
          params: request.params,
          query: request.query,
          headers: request.headers,
          body: request.body,
          raw: request,
        },
        options,
      );
      response.status(result.status);
      for (const [name, value] of Object.entries(result.headers)) {
        response.setHeader(name, value);
      }
      response.end(serializeBody(result));
    });
  }
}
