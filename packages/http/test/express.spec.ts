import type { AddressInfo } from 'node:net';
import express, { type Request } from 'express';
import { describe, expect, it } from 'vitest';
import { mountExpress } from '../src/express';
import { describeAdapter } from './support/behaviour';
import { presenceRoutes } from './support/every-method';

describeAdapter(
  'Express',
  async (routes, options) => {
    const app = express();

    app.use(
      express.json({
        // What a project that signs webhooks keeps: the bytes a raw body route reads after the parser.
        verify: (request, _response, bytes) => {
          Object.assign(request, { rawBody: bytes });
        },
      }),
    );

    // Mounted on a router to prove a router is as good a target as the application.
    const router = express.Router();

    mountExpress(router, routes, options);
    app.use(router);
    const server = app.listen(0);

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    return {
      url: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  },
  (raw) => (raw as Request).headers.authorization,
);

describe('routes mounted on Express, by method', () => {
  it('registers a HEAD and an OPTIONS route as written, each answered as declared', async () => {
    const app = express();

    mountExpress(app, presenceRoutes);
    const server = app.listen(0);

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${String(port)}/orders/o-1/presence`;

    try {
      expect((await fetch(url, { method: 'HEAD' })).status).toBe(204);
      expect((await fetch(url, { method: 'OPTIONS' })).status).toBe(204);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
