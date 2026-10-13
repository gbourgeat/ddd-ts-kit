import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express, { type IRouter, type Request, type RequestHandler, type Response } from 'express';
import type { ExecuteOptions } from '../pipeline/execute-options.js';
import { executeRoute } from '../pipeline/execute-route.js';
import { serializeBody } from '../pipeline/serialize-body.js';
import { writeStream } from '../pipeline/write-stream.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { HttpMethod } from '../route/http-method.js';
import type { Route } from '../route/route.js';

export type ExpressMountOptions = ExecuteOptions;

type ExpressHandler = (request: Request, response: Response) => Promise<void>;

type Registrar = Record<HttpMethod, (path: string, ...handlers: RequestHandler[]) => void>;

/**
 * Registers the routes on an Express 5 application or router. A JSON body parser
 * (`express.json()`) must be installed before, otherwise bodies reach validation as `undefined`.
 * An upload and a raw body are read from the request stream, which that parser leaves alone
 * unless the request is JSON; a route that consumes another media type (`consumes`) gets a text
 * parser of its own for it. A body that is a stream is piped to the response, a streamed list
 * written chunk by chunk.
 */
export function mountExpress(target: IRouter, routes: readonly Route[], options: ExpressMountOptions = {}): void {
  assertUniqueRoutes(routes);
  options.representations?.assertServes(routes);

  const register = registrarOf(target);

  for (const route of routes) {
    register[route.method](route.path, ...bodyParsers(route), handlerOf(route, options));
  }
}

function bodyParsers(route: Route): RequestHandler[] {
  const consumed = route.consumes ?? [];

  return consumed.length === 0 ? [] : [express.text({ type: [...consumed] })];
}

function registrarOf(target: IRouter): Registrar {
  return {
    GET: (path, ...handlers) => target.get(path, ...handlers),
    POST: (path, ...handlers) => target.post(path, ...handlers),
    PUT: (path, ...handlers) => target.put(path, ...handlers),
    PATCH: (path, ...handlers) => target.patch(path, ...handlers),
    DELETE: (path, ...handlers) => target.delete(path, ...handlers),
    HEAD: (path, ...handlers) => target.head(path, ...handlers),
    OPTIONS: (path, ...handlers) => target.options(path, ...handlers),
  };
}

function handlerOf(route: Route, options: ExpressMountOptions): ExpressHandler {
  return async (request, response) => {
    const { params, query, headers } = request;
    const body: unknown = request.body;
    const result = await executeRoute(route, { params, query, headers, body, raw: request, stream: request }, options);

    response.status(result.status);

    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value);
    }

    if (result.body instanceof Readable) {
      await pipeline(result.body, response).catch(() => response.destroy());
    } else if (result.stream === undefined) {
      response.end(serializeBody(result));
    } else {
      await writeStream(response, result.stream);
    }
  };
}
