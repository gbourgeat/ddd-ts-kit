import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { resetTracingConfiguration, withSpan } from '../src';
import { initTracing } from '../src/node';

/*
 * In a file of its own: the SDK registers the global tracer once per process, and a second SDK
 * started in the same file would find the first one still registered after its shutdown.
 */
afterEach(() => {
  resetTracingConfiguration();
});

describe('initTracing, given the URL of a collector', () => {
  it('exports the spans there, when the SDK shuts down at the latest', async () => {
    const received: { readonly path: string; readonly body: string }[] = [];

    const collector = createServer((request, response) => {
      let body = '';

      request.setEncoding('utf8');
      request.on('data', (chunk: string) => void (body += chunk));

      request.on('end', () => {
        received.push({ path: request.url ?? '', body });
        response.setHeader('content-type', 'application/json');
        response.end('{}');
      });
    });

    await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
    const { port } = collector.address() as AddressInfo;

    const tracing = initTracing({
      serviceName: 'billing',
      exporterUrl: `http://127.0.0.1:${String(port)}/v1/traces`,
      instrumentations: [],
    });

    withSpan('work', () => undefined);
    await tracing.shutdown();
    await new Promise<void>((resolve) => collector.close(() => resolve()));

    expect(received.map(({ path }) => path)).toEqual(['/v1/traces']);
    expect(received[0]?.body).toContain('work');
  });
});
