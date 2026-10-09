import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DROPPED_SPANS_ATTRIBUTE,
  configureTracing,
  resetTracingConfiguration,
  traceDependency,
  withSpan,
} from '../src/index.js';
import { initTracing } from '../src/node.js';

afterEach(() => {
  vi.unstubAllEnvs();
  resetTracingConfiguration();
});

describe('initTracing', () => {
  it('is a no-op when disabled by option', async () => {
    const tracing = initTracing({ serviceName: 'billing', enabled: false });

    withSpan('work', () => expect(trace.getActiveSpan()).toBeUndefined());
    await expect(tracing.shutdown()).resolves.toBeUndefined();
  });

  it('is a no-op when OTEL_SDK_DISABLED is true', async () => {
    vi.stubEnv('OTEL_SDK_DISABLED', 'true');
    const tracing = initTracing({ serviceName: 'billing' });

    withSpan('work', () => expect(trace.getActiveSpan()).toBeUndefined());
    await tracing.shutdown();
  });

  it('starts an SDK with the tracker and the scrubbing processors installed', async () => {
    const exporter = new InMemorySpanExporter();
    const processor = new SimpleSpanProcessor(exporter);
    const tracing = initTracing({
      serviceName: 'billing',
      serviceVersion: '1.2.3',
      environment: 'test',
      sampleRatio: 1,
      instrumentations: [],
      extraSpanProcessors: [processor],
    });
    configureTracing({ maxSpansPerName: 1 });
    const gateway = traceDependency(
      { ping: async (): Promise<void> => {} },
      { kind: 'gateway', className: 'Ping' },
    );

    await withSpan(
      'request',
      async () => {
        await gateway.ping();
        await gateway.ping();
        trace.getActiveSpan()?.recordException(new Error('secret'));
      },
      { 'url.full': 'https://example.org/?token=abc' },
    );
    // Export waits for the detected resource attributes, and shutdown empties the exporter.
    await processor.forceFlush();
    const spans = [...exporter.getFinishedSpans()];
    await tracing.shutdown();

    const request = spans.find((span) => span.name === 'request');
    expect(spans.map((span) => span.name)).toEqual(['gateway.Ping.ping', 'request']);
    expect(request?.attributes).toEqual({
      'url.full': 'https://example.org/?token=REDACTED',
      [DROPPED_SPANS_ATTRIBUTE]: 1,
    });
    expect(request?.events[0]?.attributes).not.toHaveProperty('exception.message');
    expect(request?.resource.attributes).toMatchObject({
      'service.name': 'billing',
      'service.version': '1.2.3',
      'deployment.environment.name': 'test',
    });
  });
});
