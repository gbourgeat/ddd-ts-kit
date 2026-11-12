import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { ExecuteOptions, Route } from '../../src';
import { createRoutesModule } from '../../src/nest';
import type { RunningServer } from './running-server';

export async function onNestExpress(routes: readonly Route[], options: ExecuteOptions): Promise<RunningServer> {
  const app = await NestFactory.create(createRoutesModule(routes, options), { logger: false, abortOnError: false });

  await app.listen(0, '127.0.0.1');

  return { url: await app.getUrl(), close: () => app.close() };
}

export async function onNestFastify(routes: readonly Route[], options: ExecuteOptions): Promise<RunningServer> {
  const app = await NestFactory.create(createRoutesModule(routes, options), new FastifyAdapter(), {
    logger: false,
    abortOnError: false,
  });

  await app.listen(0, '127.0.0.1');

  return { url: await app.getUrl(), close: () => app.close() };
}
