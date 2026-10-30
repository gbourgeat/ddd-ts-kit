import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { mountHono, type HonoRaw } from '../src/hono';
import { describeAdapter } from './support/behaviour';
import { KNOWN_ORDER, orderRoutes } from './support/orders';

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
    expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
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

describe('a body larger than Hono reads', () => {
  const post = (app: Hono, body: string, headers: Record<string, string> = {}) =>
    app.request('/orders', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

  it('is refused 413 as a problem when it announces its size, before a byte is read', async () => {
    const app = new Hono();

    mountHono(app, orderRoutes, { bodyLimit: 16 });

    const response = await post(app, JSON.stringify({ sku: 'x'.repeat(64) }), { 'x-request-id': 'req-2' });

    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
    expect(await response.json()).toMatchObject({ status: 413, code: 'BODY_TOO_LARGE', requestId: 'req-2' });
  });

  it('is refused 413 on a socket, by the size the request announces, before its body is read', async () => {
    const app = new Hono();

    mountHono(app, orderRoutes, { bodyLimit: 16 });

    const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    const status = await new Promise<number | undefined>((resolve, reject) => {
      const sent = httpRequest(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/orders',
          headers: { 'content-type': 'application/json', 'content-length': '1000000' },
        },
        (answer) => {
          answer.resume();
          answer.on('end', () => resolve(answer.statusCode));
        },
      );

      sent.on('error', reject);
      sent.flushHeaders();
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(status).toBe(413);
  });

  it('is refused 413 when it streams past the limit without announcing its size', async () => {
    const app = new Hono();
    const chunk = new TextEncoder().encode(JSON.stringify({ sku: 'x'.repeat(64) }));

    mountHono(app, orderRoutes, { bodyLimit: 16 });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.close();
      },
    });

    const response = await app.request('/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'BODY_TOO_LARGE' });
  });

  it('is read up to 1 MiB by default, as Fastify reads it', async () => {
    const app = new Hono();

    mountHono(app, orderRoutes);

    const within = await post(app, JSON.stringify({ note: 'x'.repeat(1_000_000) }));
    const beyond = await post(app, JSON.stringify({ note: 'x'.repeat(1_048_577) }));

    expect(within.status).not.toBe(413);
    expect(beyond.status).toBe(413);
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
