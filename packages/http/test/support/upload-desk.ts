import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { z } from 'zod';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Controller,
  Public,
  controllerRoutes,
  type ExecuteOptions,
  type HttpRequest,
  type IncomingFile,
  type Route,
} from '../../src';
import { mountExpress } from '../../src/express';
import { mountFastify } from '../../src/fastify';
import { mountHono, type HonoMountOptions } from '../../src/hono';
import type { RunningServer } from './running-server';

const fields = zodSchema(z.object({ title: z.string().min(1) }));

const attached = zodSchema(
  z.object({ title: z.string(), fileName: z.string(), size: z.number(), mediaType: z.string() }),
  { io: 'output' },
);

export const UPLOAD = { field: 'document', maxBytes: 64, mediaTypes: ['application/pdf', 'text/*'] } as const;

interface Attached {
  readonly title: string;
  readonly fileName: string;
  readonly size: number;
  readonly mediaType: string;
}

/** A controller that streams the file it receives into the storage, and says what was stored. */
export class AttachDocumentController {
  constructor(readonly storage: InMemoryFileStorage) {}

  async handle({ body, upload }: HttpRequest<{ body: { title: string }; upload: IncomingFile }>): Promise<Attached> {
    const stored = await this.storage.put('documents/attached', upload.stream, { mediaType: upload.mediaType });

    return { title: body.title, fileName: upload.fileName, size: stored.size, mediaType: stored.mediaType };
  }
}

Controller({
  method: 'POST',
  path: '/documents',
  summary: 'Attach a document',
  guards: [Public],
  body: fields,
  upload: UPLOAD,
  response: { status: 201, body: attached },
})(AttachDocumentController);

export function uploadRoutes(storage: InMemoryFileStorage): readonly Route[] {
  return controllerRoutes([new AttachDocumentController(storage)]);
}

export async function onExpress(routes: readonly Route[], options: ExecuteOptions): Promise<RunningServer> {
  const app = express();

  app.use(express.json());
  mountExpress(app, routes, options);
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve) => server.once('listening', resolve));

  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** The order a project serving its own files writes: the file routes, then the JSON parser, then the others. */
export async function onExpressFilesFirst(files: readonly Route[]): Promise<RunningServer> {
  const app = express();

  mountExpress(app, files, {});
  app.use(express.json());
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve) => server.once('listening', resolve));

  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function onFastify(routes: readonly Route[], options: ExecuteOptions): Promise<RunningServer> {
  const app = Fastify();

  mountFastify(app, routes, options);
  const url = await app.listen({ port: 0, host: '127.0.0.1' });

  return { url, close: () => app.close() };
}

export async function onHono(routes: readonly Route[], options: HonoMountOptions): Promise<RunningServer> {
  const app = new Hono();

  mountHono(app, routes, options);

  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });

  await new Promise((resolve) => server.once('listening', resolve));

  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
