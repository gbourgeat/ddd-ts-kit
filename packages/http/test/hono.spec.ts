import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { mountHono, type HonoRaw } from '../src/hono.js';
import { describeAdapter } from './support/behaviour.js';
import { KNOWN_ORDER, orderRoutes } from './support/orders.js';

describeAdapter(
  'Hono',
  async (routes, options) => {
    const app = new Hono();

    mountHono(app, routes, options);

    const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    return {
      url: `http://127.0.0.1:${String(port)}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  },
  (raw) => {
    const authorization = (raw as HonoRaw).headers['authorization'];

    return typeof authorization === 'string' ? authorization : undefined;
  },
);

describe('a body Hono cannot read as JSON', () => {
  it('is answered 400 as a problem, before the pipeline runs', async () => {
    const app = new Hono();

    mountHono(app, orderRoutes);

    const response = await app.request('/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
      body: '{ not json',
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ status: 400, code: 'MALFORMED_BODY', requestId: 'req-1' });
  });

  it('reads no body that is not JSON', async () => {
    const app = new Hono();

    mountHono(app, orderRoutes);

    const response = await app.request('/orders', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x',
    });

    expect(response.status).toBe(422);
  });
});

describe('a query string read by Hono', () => {
  it('keeps a single value as text and a repeated one as a list, as Express and Fastify do', async () => {
    const app = new Hono();

    mountHono(app, orderRoutes);

    const once = await app.request(`/orders/${KNOWN_ORDER}?expand=lines`);
    const twice = await app.request(`/orders/${KNOWN_ORDER}?expand=lines&expand=lines`);

    expect(once.status).toBe(200);
    expect(twice.status).toBe(422);
    expect(await twice.json()).toMatchObject({ issues: [{ path: 'query.expand' }] });
  });
});
