import { createRequire } from 'node:module';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { defineRoute, executeRoute } from '@ddd-ts-kit/http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tracedRoutes } from '../src/index.js';
import { initTracing, type TracingHandle } from '../src/node.js';

/** No hexadecimal digit in it: a random trace, span or correlation identifier cannot contain it by chance. */
const URL_SECRET = 'zq-url-secret-zq';

const read = defineRoute(
  {
    method: 'GET',
    path: '/appointments/:id',
    operationId: 'getAppointment',
    summary: 'Read',
    responses: { 204: { description: 'Found.' } },
    security: false,
  },
  async () => ({ status: 204 }),
);

const health = defineRoute(
  {
    method: 'GET',
    path: '/health',
    operationId: 'health',
    summary: 'Probe',
    responses: { 204: { description: 'Up.' } },
    security: false,
  },
  async () => ({ status: 204 }),
);

describe('a real HTTP server under the default instrumentations', () => {
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor(exporter);
  let tracing: TracingHandle;
  let origin: string;
  let close: () => void;

  beforeAll(async () => {
    tracing = initTracing({ serviceName: 'clinic', extraSpanProcessors: [processor] });

    // Required after the SDK started, as an application loads `http` after `platform/observability/tracing`.
    const http: typeof import('node:http') = createRequire(import.meta.url)('node:http');
    const around = tracedRoutes();

    const server = http.createServer((request, response) => {
      const route = request.url?.startsWith('/health') === true ? health : read;

      void executeRoute(route, { params: {}, query: {}, headers: {}, body: undefined, raw: request }, { around }).then(
        ({ status }) => {
          response.statusCode = status;
          response.end();
        },
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
    close = () => void server.close();
  });

  afterAll(async () => {
    close();
    await tracing.shutdown();
  });

  it('names the server span by the route template, keeps the URL secrets out, and makes no span for a probe', async () => {
    await fetch(`${origin}/appointments/42?token=${URL_SECRET}`);
    await fetch(`${origin}/health`);
    await fetch(`${origin}/appointments/43`);
    await processor.forceFlush();

    const spans = exporter.getFinishedSpans();

    expect(spans.map((span) => span.name)).toEqual(['GET /appointments/:id', 'GET /appointments/:id']);

    expect(spans[0]?.attributes).toMatchObject({
      'http.route': '/appointments/:id',
      'app.operation': 'getAppointment',
      'http.response.status_code': 204,
    });

    expect(JSON.stringify(spans[0]?.attributes)).not.toContain(URL_SECRET);

    expect(
      Object.keys(spans[0]?.attributes ?? {}).filter((key) => key.includes('header') || key.startsWith('client.')),
    ).toEqual([]);
  });
});
