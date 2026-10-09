import 'reflect-metadata';
import { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { Route } from '@ddd-ts-kit/http';
import { createAppModule } from './application.js';
import type { AppConfig } from './config.js';
{{#if docs.any}}
import { withDocumentation } from './http-docs.js';
{{/if}}

export interface HttpServer {
  /** The port really bound: differs from the configured one when that was 0. */
  readonly port: number;
  close(): Promise<void>;
}

export async function startHttpServer(routes: readonly Route[], config: AppConfig): Promise<HttpServer> {
{{#if docs.any}}
  const app = await NestFactory.create(createAppModule(withDocumentation(routes, config)), { logger: ['error', 'warn'] });
{{/if}}
{{#unless docs.any}}
  const app = await NestFactory.create(createAppModule(routes), { logger: ['error', 'warn'] });
{{/unless}}
  await app.listen(config.port);
  return { port: boundPort(app.getHttpServer()), close: () => app.close() };
}

// Nest types its HTTP server loosely: the port is read only from what proves to be a Node server.
function boundPort(server: unknown): number {
  const address = server instanceof Server ? server.address() : null;
  return typeof address === 'object' && address !== null ? address.port : 0;
}
