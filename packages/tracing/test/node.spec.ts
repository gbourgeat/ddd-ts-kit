import { metrics, trace } from '@opentelemetry/api';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DROPPED_SPANS_ATTRIBUTE,
  configureTracing,
  resetTracingConfiguration,
  traceDependency,
  withSpan,
} from '../src';
import { defaultInstrumentations, initTracing } from '../src/node';

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

  it('starts an SDK with the tracker and the scrubbing processors installed, and no metric reader without an endpoint', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', undefined);
    vi.stubEnv('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT', undefined);
    const exporter = new InMemorySpanExporter();
    const processor = new SimpleSpanProcessor({ exporter });

    const tracing = initTracing({
      serviceName: 'billing',
      serviceVersion: '1.2.3',
      environment: 'test',
      sampleRatio: 1,
      instrumentations: [],
      extraSpanProcessors: [processor],
    });

    configureTracing({ maxSpansPerName: 1 });

    // No reader, no provider: the API keeps its own, whose instruments measure nothing.
    expect(metrics.getMeterProvider()).not.toBeInstanceOf(MeterProvider);

    const gateway = traceDependency({ ping: async (): Promise<void> => {} }, { kind: 'gateway', className: 'Ping' });

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

    expect(spans.map((span) => span.name)).toEqual(['gateway Ping.ping', 'request']);

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

describe('initTracing, given an OTLP endpoint and OTEL_METRICS_EXPORTER', () => {
  it.each(['none', 'prometheus', 'otlp,console'])('registers no metric reader for %s', async (exporter) => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:1');
    vi.stubEnv('OTEL_METRICS_EXPORTER', exporter);

    const tracing = initTracing({ serviceName: 'billing', instrumentations: [] });

    expect(metrics.getMeterProvider()).not.toBeInstanceOf(MeterProvider);
    await tracing.shutdown();
  });
});

describe('the instrumentations on by default', () => {
  const names = (settings?: Parameters<typeof defaultInstrumentations>[0]): string[] =>
    defaultInstrumentations(settings)
      .map((instrumentation) => instrumentation.instrumentationName.replace('@opentelemetry/instrumentation-', ''))
      .sort();

  it('are the two sides of HTTP and the database and cache drivers, nothing else', () => {
    expect(names()).toEqual(['grpc', 'http', 'ioredis', 'mongodb', 'mysql', 'mysql2', 'pg', 'redis', 'undici']);
  });

  it('record a statement as written and only inside a trace, and no connection span', () => {
    const pg = defaultInstrumentations().find((instrumentation) => instrumentation.instrumentationName.endsWith('-pg'));

    expect(pg?.getConfig()).toMatchObject({
      requireParentSpan: true,
      ignoreConnectSpans: true,
      enhancedDatabaseReporting: false,
    });
  });

  it('ignore the incoming requests of the noise paths, the given ones when given', () => {
    const ignores = (url: string, ignoredPaths?: readonly string[]): unknown => {
      const http = defaultInstrumentations(ignoredPaths === undefined ? {} : { ignoredPaths }).find((instrumentation) =>
        instrumentation.instrumentationName.endsWith('-http'),
      );

      const hook: unknown = Reflect.get(http?.getConfig() ?? {}, 'ignoreIncomingRequestHook');

      return typeof hook === 'function' ? Reflect.apply(hook, undefined, [{ url }]) : undefined;
    };

    expect(ignores('/health')).toBe(true);
    expect(ignores('/readyz?verbose=1')).toBe(true);
    expect(ignores('/orders/42')).toBe(false);
    expect(ignores('/health', ['/status'])).toBe(false);
    expect(ignores('/status', ['/status'])).toBe(true);
  });

  it('change one by one when the application says so', () => {
    const settings = {
      '@opentelemetry/instrumentation-fs': { enabled: true },
      '@opentelemetry/instrumentation-grpc': { enabled: false },
    };

    expect(names({ settings })).toEqual([
      'fs',
      'http',
      'ioredis',
      'mongodb',
      'mysql',
      'mysql2',
      'pg',
      'redis',
      'undici',
    ]);
  });
});
