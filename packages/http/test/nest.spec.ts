import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { Request } from 'express';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute } from '../src/index.js';
import { createRoutesModule } from '../src/nest.js';
import { describeAdapter } from './support/behaviour.js';

describeAdapter(
  'NestJS over Express',
  async (routes, options) => {
    const app = await NestFactory.create(createRoutesModule(routes, options), {
      logger: false,
      abortOnError: false,
    });
    await app.listen(0, '127.0.0.1');
    return { url: await app.getUrl(), close: () => app.close() };
  },
  (raw) => (raw as Request).headers.authorization,
);

describeAdapter(
  'NestJS over Fastify',
  async (routes, options) => {
    const app = await NestFactory.create(createRoutesModule(routes, options), new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await app.listen(0, '127.0.0.1');
    return { url: await app.getUrl(), close: () => app.close() };
  },
  (raw) => (raw as FastifyRequest).headers.authorization,
);

describe('a Nest routes module built from injected dependencies', () => {
  const GREETER = Symbol('greeter');
  interface Greeter {
    greet(name: string): string;
  }

  class GreeterModule {}
  const greeterModule: DynamicModule = {
    module: GreeterModule,
    providers: [{ provide: GREETER, useValue: { greet: (name: string) => `Hello ${name}` } }],
    exports: [GREETER],
  };

  it('gives the handlers their dependencies by closure', async () => {
    const routes = createRoutesModule(
      {
        inject: [GREETER],
        useFactory: (greeter: Greeter) => [
          defineRoute(
            {
              method: 'GET',
              path: '/greetings/:name',
              operationId: 'greet',
              summary: 'Greet someone',
              request: { params: zodSchema(z.object({ name: z.string() })) },
              responses: { 200: { description: 'The greeting.', body: zodSchema(z.object({ text: z.string() })) } },
            },
            ({ params }) => ({ status: 200, body: { text: greeter.greet(params.name) } }),
          ),
        ],
      },
      { imports: [greeterModule] },
    );
    const app = await NestFactory.create(routes, { logger: false, abortOnError: false });
    await app.listen(0, '127.0.0.1');
    try {
      const response = await fetch(`${await app.getUrl()}/greetings/Ada`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ text: 'Hello Ada' });
      // A path nobody declared still reaches Nest's own not-found handling.
      expect((await fetch(`${await app.getUrl()}/nowhere`)).status).toBe(404);
    } finally {
      await app.close();
    }
  });
});
