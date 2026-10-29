import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import express, { type NextFunction, type Request, type Response } from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { mountExpress, problemErrorHandler as expressErrorHandler } from '../../src/express';
import { mountFastify, problemErrorHandler as fastifyErrorHandler } from '../../src/fastify';
import { mountHono, problemErrorHandler as honoErrorHandler } from '../../src/hono';
import { createRoutesModule, ProblemExceptionFilter } from '../../src/nest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, type Route } from '../../src';
import { orderRoutes, SECRET } from './orders';
import type { RunningServer } from './running-server';

/** A route that says whether a body reached it, any body its schema lets through. */
const echoBody = defineRoute(
  {
    method: 'POST',
    path: '/echo',
    operationId: 'echoBody',
    summary: 'Say whether a body arrived',
    request: { body: zodSchema(z.unknown()) },
    responses: {
      200: { description: 'What arrived.', body: zodSchema(z.object({ absent: z.boolean() }), { io: 'output' }) },
    },
    security: false,
  },
  ({ body }) => ({ status: 200, body: { absent: body === undefined } }),
);

const EDGE_ROUTES: readonly Route[] = [...orderRoutes, echoBody];

/** The challenge a middleware in front of the routes refuses with, on `/unauthenticated`. */
export const CHALLENGE = 'Bearer realm="orders"';

export type Start = (logger: InMemoryLogger | undefined) => Promise<RunningServer>;

/** What the middlewares in front of the routes raise, by path: a failure, a store down on purpose. */
const RAISED: Readonly<Record<string, () => Error>> = {
  '/failing': () => new Error(SECRET),
  '/unavailable': () => Object.assign(new Error(SECRET), { status: 503 }),
  // As http-errors builds it for Express, and as Fastify reads it: the challenge travels with the refusal.
  '/unauthenticated': () =>
    Object.assign(new Error(SECRET), { status: 401, headers: { 'WWW-Authenticate': CHALLENGE } }),
};

/** On Hono, the response an HTTPException carries holds the headers of the refusal. */
const HONO_RAISED: Readonly<Record<string, () => Error>> = {
  ...RAISED,
  '/unauthenticated': () =>
    new HTTPException(401, {
      res: new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': CHALLENGE } }),
    }),
};

/** A middleware in front of the routes that fails, as the limit of each caller does when its store does. */
function raising(path: string) {
  return (_request: Request, _response: Response, next: NextFunction): void => {
    next(RAISED[path]?.());
  };
}

function raiseOn(app: { use(path: string, handler: ReturnType<typeof raising>): unknown }): void {
  for (const path of Object.keys(RAISED)) {
    app.use(path, raising(path));
  }
}

export const startExpress: Start = async (logger) => {
  const app = express();

  raiseOn(app);
  app.use(express.json());
  mountExpress(app, EDGE_ROUTES);
  app.use(expressErrorHandler(logger === undefined ? {} : { logger }));

  return listening(app.listen(0, '127.0.0.1'));
};

export const startFastify: Start = async (logger) => {
  const app = Fastify({ bodyLimit: 1024 });

  app.setErrorHandler(fastifyErrorHandler(logger === undefined ? {} : { logger }));

  app.addHook('onRequest', async (request) => {
    const raised = RAISED[request.url];

    if (raised !== undefined) {
      throw raised();
    }
  });

  mountFastify(app, EDGE_ROUTES);

  const url = await app.listen({ port: 0, host: '127.0.0.1' });

  return { url, close: () => app.close() };
};

export const startHono: Start = async (logger) => {
  const app = new Hono();

  app.onError(honoErrorHandler(logger === undefined ? {} : { logger }));

  for (const [path, raised] of Object.entries(HONO_RAISED)) {
    app.use(path, () => {
      throw raised();
    });
  }

  mountHono(app, EDGE_ROUTES, { bodyLimit: 1024 });

  return listening(serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }));
};

export function nestOver(platform: 'express' | 'fastify'): Start {
  return async (logger) => {
    const module = createRoutesModule(EDGE_ROUTES);

    const app =
      platform === 'express'
        ? await NestFactory.create(module, { logger: false, abortOnError: false, rawBody: true })
        : await NestFactory.create(module, new FastifyAdapter({ bodyLimit: 1024 }), {
            logger: false,
            abortOnError: false,
          });

    app.useGlobalFilters(new ProblemExceptionFilter(app.getHttpAdapter(), logger === undefined ? {} : { logger }));

    raiseOn(app);
    await app.listen(0, '127.0.0.1');

    return { url: await app.getUrl(), close: () => app.close() };
  };
}

interface Listening {
  once(event: 'listening', listener: () => void): unknown;
  address(): AddressInfo | string | null;
  close(callback: () => void): unknown;
}

export async function listening(server: Listening): Promise<RunningServer> {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
