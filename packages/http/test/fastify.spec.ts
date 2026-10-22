import { describe, expect, it } from 'vitest';
import Fastify, { type FastifyRequest } from 'fastify';
import { fastifyRoutes, mountFastify } from '../src/fastify';
import { describeAdapter } from './support/behaviour';
import { KNOWN_ORDER, orderRoutes } from './support/orders';

describeAdapter(
  'Fastify',
  async (routes, options) => {
    const app = Fastify();

    mountFastify(app, routes, options);
    const url = await app.listen({ port: 0, host: '127.0.0.1' });

    return { url, close: () => app.close() };
  },
  (raw) => (raw as FastifyRequest).headers.authorization,
);

describe('routes registered as a Fastify plugin', () => {
  it('honours the prefix given at registration', async () => {
    const app = Fastify();

    await app.register(fastifyRoutes(orderRoutes), { prefix: '/api' });
    const response = await app.inject({ method: 'GET', url: `/api/orders/${KNOWN_ORDER}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: KNOWN_ORDER });
    await app.close();
  });
});
