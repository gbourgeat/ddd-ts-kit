import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { initTracing } from '@ddd-ts-kit/tracing/node';
import { expect } from 'vitest';
import { aTracker, type Tracker } from './a-tracker';
import { failingRequest } from './failing-request';

type Setup = 'tracing' | 'sentry';

/**
 * Starts the kit's tracing and the error reporter in the given order, fails one traced
 * request, and holds both to their side: the event names the trace, the trace stays the kit's.
 */
export async function expectCoexistence(order: readonly [Setup, Setup]): Promise<void> {
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor({ exporter });
  let tracker: Tracker | undefined;
  let tracing: ReturnType<typeof initTracing> | undefined;

  for (const setup of order) {
    if (setup === 'sentry') {
      tracker = await aTracker();
    } else {
      tracing = initTracing({
        serviceName: 'shop',
        sampleRatio: 1,
        instrumentations: [],
        extraSpanProcessors: [processor],
      });
    }
  }

  if (tracker === undefined || tracing === undefined) {
    throw new Error('Both must be started.');
  }

  const { status, span } = await failingRequest(tracker.errors);

  await tracker.errors.flush(2_000);
  await processor.forceFlush();

  const spans = exporter
    .getFinishedSpans()
    .map((finished) => ({ name: finished.name, traceId: finished.spanContext().traceId }));

  const [event] = tracker.server.events;

  await tracker.stop();
  await tracing.shutdown();

  expect(status).toBe(500);
  expect(span?.traceId).toMatch(/^[0-9a-f]{32}$/);
  expect(event?.contexts?.trace).toMatchObject({ trace_id: span?.traceId, span_id: span?.spanId });
  expect(event?.tags).toMatchObject({ operation: 'shipOrder', correlation_id: 'corr-1' });
  expect(spans).toEqual([{ name: 'POST /orders/ship', traceId: span?.traceId }]);
  expect(tracker.server.itemTypes).toEqual(['event']);
  expect(trace.getTracer('probe').constructor.name).not.toContain('Sentry');
}
