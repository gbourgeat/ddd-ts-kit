import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { metrics, trace } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openTelemetryMetrics, resetTracingConfiguration } from '../src';
import { initTracing } from '../src/node';

/*
 * In a file of its own: the SDK registers the global providers once per process. Each test
 * unregisters them, so that the next one starts its own.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  metrics.disable();
  trace.disable();
  resetTracingConfiguration();
});

interface Collector {
  readonly url: string;
  readonly paths: string[];
  /** Resolves once a request reached the path, with its body. */
  received(path: string): Promise<string>;
  close(): Promise<void>;
}

async function startCollector(): Promise<Collector> {
  const paths: string[] = [];
  const waiting: { readonly path: string; readonly resolve: (body: string) => void }[] = [];

  const server: Server = createServer((request, response) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => void (body += chunk));

    request.on('end', () => {
      paths.push(request.url ?? '');
      waiting.filter(({ path }) => path === request.url).forEach(({ resolve }) => resolve(body));
      response.setHeader('content-type', 'application/json');
      response.end('{}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${String(port)}`,
    paths,
    received: (path) => new Promise((resolve) => waiting.push({ path, resolve })),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe('initTracing, given the endpoint of a collector', () => {
  it('exports the metrics there on the interval of OTEL_METRIC_EXPORT_INTERVAL', async () => {
    const collector = await startCollector();

    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', collector.url);
    vi.stubEnv('OTEL_METRIC_EXPORT_INTERVAL', '50');

    const tracing = initTracing({ serviceName: 'billing', instrumentations: [] });

    openTelemetryMetrics({ meterName: 'billing' }).counter('use_case_total').increment({ outcome: 'success' });
    const body = await collector.received('/v1/metrics');

    await tracing.shutdown();
    await collector.close();

    expect(body).toContain('use_case_total');
  });

  it('exports them on the interval it is given, to the metrics endpoint when it is set', async () => {
    const collector = await startCollector();

    vi.stubEnv('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT', `${collector.url}/v1/metrics`);

    const tracing = initTracing({ serviceName: 'billing', instrumentations: [], metricsExportIntervalMillis: 50 });

    openTelemetryMetrics().gauge('outbox_pending').set(3);
    const body = await collector.received('/v1/metrics');

    await tracing.shutdown();
    await collector.close();

    expect(body).toContain('outbox_pending');
  });
});
