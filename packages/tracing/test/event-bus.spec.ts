import { ROOT_CONTEXT, SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { InMemoryEventBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  captureTraceparent,
  correlationIdFromActiveSpan,
  runWithTraceparent,
  spanContextFromTraceparent,
  traceLogFields,
  traceparentFromContext,
  tracedPublisher,
  tracedSubscriber,
  withSpan,
} from '../src/index.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const SPAN_ID = '00f067aa0ba902b7';
const TRACEPARENT = `00-${TRACE_ID}-${SPAN_ID}-01`;

const orderPlaced = (overrides: Partial<IntegrationEvent> = {}): IntegrationEvent => ({
  id: 'evt-1',
  type: 'ordering.order.placed',
  version: 1,
  occurredAt: '2025-01-01T00:00:00.000Z',
  payload: { orderId: 'order-1', email: 'jane@example.org' },
  ...overrides,
});

let tracing: TestTracing;

beforeEach(() => {
  tracing = setupTracing();
});

afterEach(() => tracing.teardown());

describe('traceparent', () => {
  it('parses a valid value into a remote span context', () => {
    expect(spanContextFromTraceparent(TRACEPARENT)).toEqual({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: 1,
      isRemote: true,
    });
  });

  it.each([
    ['all-zero trace id', `00-${'0'.repeat(32)}-${SPAN_ID}-01`],
    ['all-zero span id', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
    ['uppercase hex', TRACEPARENT.toUpperCase()],
    ['unknown version', `01-${TRACE_ID}-${SPAN_ID}-01`],
    ['short trace id', `00-${TRACE_ID.slice(1)}-${SPAN_ID}-01`],
    ['trailing data', `${TRACEPARENT}-extra`],
    ['surrounding space', ` ${TRACEPARENT}`],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(spanContextFromTraceparent(value)).toBeUndefined();
  });

  it('captures the active span and round-trips through the parser', () => {
    expect(captureTraceparent()).toBeUndefined();
    expect(traceparentFromContext(ROOT_CONTEXT)).toBeUndefined();

    withSpan('request', () => {
      const captured = captureTraceparent();
      const active = trace.getActiveSpan()?.spanContext();

      expect(captured).toBe(traceparentFromContext(context.active()));
      expect(captured).toBe(`00-${active?.traceId}-${active?.spanId}-01`);
    });
  });

  it('runs a function with the remote span as parent', () => {
    runWithTraceparent(TRACEPARENT, () => withSpan('work', () => undefined));

    const span = tracing.span('work');

    expect(span.spanContext().traceId).toBe(TRACE_ID);
    expect(span.parentSpanContext?.spanId).toBe(SPAN_ID);
  });

  it('runs the function in the current context when there is no usable traceparent', () => {
    expect(runWithTraceparent(undefined, () => captureTraceparent())).toBeUndefined();
    expect(runWithTraceparent('garbage', () => 'done')).toBe('done');
  });
});

describe('tracedPublisher', () => {
  it('stamps a traceparent pointing at a PRODUCER span and never records the payload', async () => {
    const bus = new InMemoryEventBus();

    await withSpan('request', () => tracedPublisher(bus).publish([orderPlaced()]));

    const span = tracing.span('publish ordering.order.placed');

    expect(span.kind).toBe(SpanKind.PRODUCER);
    expect(span.parentSpanContext?.spanId).toBe(tracing.span('request').spanContext().spanId);

    expect(span.attributes).toEqual({
      'messaging.operation': 'publish',
      'messaging.destination.name': 'ordering.order.placed',
      'messaging.message.id': 'evt-1',
    });

    const { traceId, spanId } = span.spanContext();

    expect(bus.published[0]?.traceparent).toBe(`00-${traceId}-${spanId}-01`);
    expect(bus.published[0]?.payload).toEqual(orderPlaced().payload);
  });

  it('keeps an existing traceparent and attaches the span to that trace', async () => {
    const bus = new InMemoryEventBus();

    await tracedPublisher(bus).publish([orderPlaced({ traceparent: TRACEPARENT })]);

    expect(bus.published[0]?.traceparent).toBe(TRACEPARENT);
    const span = tracing.span('publish ordering.order.placed');

    expect(span.spanContext().traceId).toBe(TRACE_ID);
    expect(span.parentSpanContext?.spanId).toBe(SPAN_ID);
  });

  it('opens one span per event and publishes the batch in one call', async () => {
    const batches: number[] = [];

    const publisher = tracedPublisher({
      publish: async (events) => void batches.push(events.length),
    });

    await publisher.publish([orderPlaced(), orderPlaced({ id: 'evt-2', type: 'ordering.order.paid' })]);

    expect(batches).toEqual([2]);

    expect(tracing.spans().map((span) => span.name)).toEqual([
      'publish ordering.order.placed',
      'publish ordering.order.paid',
    ]);
  });

  it('marks the spans failed without the message and rethrows', async () => {
    const failure = new Error('broker refused jane@example.org');

    const publisher = tracedPublisher({
      publish: async () => {
        throw failure;
      },
    });

    await expect(publisher.publish([orderPlaced()])).rejects.toBe(failure);

    const span = tracing.span('publish ordering.order.placed');

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(JSON.stringify([span.attributes, span.events])).not.toContain('jane');
  });

  it('leaves events untouched when no tracing SDK is registered', async () => {
    tracing.teardown();
    const bus = new InMemoryEventBus();

    await tracedPublisher(bus).publish([orderPlaced()]);

    expect(bus.published[0]).toEqual(orderPlaced());
  });
});

describe('tracedSubscriber', () => {
  it('runs the handler in a CONSUMER span continuing the event traceparent', async () => {
    const bus = new InMemoryEventBus();
    let seenInHandler: string | undefined;

    tracedSubscriber(bus).subscribe('ordering.order.placed', async () => {
      seenInHandler = correlationIdFromActiveSpan();
    });

    await bus.publish([orderPlaced({ traceparent: TRACEPARENT })]);

    const span = tracing.span('process ordering.order.placed');

    expect(span.kind).toBe(SpanKind.CONSUMER);
    expect(span.spanContext().traceId).toBe(TRACE_ID);
    expect(span.parentSpanContext?.spanId).toBe(SPAN_ID);

    expect(span.attributes).toEqual({
      'messaging.operation': 'process',
      'messaging.destination.name': 'ordering.order.placed',
      'messaging.message.id': 'evt-1',
    });

    expect(seenInHandler).toBe(TRACE_ID);
  });

  it('links publisher and consumer into one trace through the bus', async () => {
    const bus = new InMemoryEventBus();

    tracedSubscriber(bus).subscribe('ordering.order.placed', async () => {});

    await tracedPublisher(bus).publish([orderPlaced()]);

    const produced = tracing.span('publish ordering.order.placed');
    const consumed = tracing.span('process ordering.order.placed');

    expect(consumed.spanContext().traceId).toBe(produced.spanContext().traceId);
    expect(consumed.parentSpanContext?.spanId).toBe(produced.spanContext().spanId);
  });

  it('marks the span failed and lets the bus see the handler error', async () => {
    const bus = new InMemoryEventBus();

    tracedSubscriber(bus).subscribe('ordering.order.placed', async () => {
      throw new Error('cannot bill jane@example.org');
    });

    await expect(bus.publish([orderPlaced()])).rejects.toThrow(AggregateError);

    const span = tracing.span('process ordering.order.placed');

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.events).toHaveLength(0);
  });

  it('returns a subscription that unsubscribes the handler', async () => {
    const bus = new InMemoryEventBus();

    tracedSubscriber(bus)
      .subscribe('ordering.order.placed', async () => {})
      .unsubscribe();

    await bus.publish([orderPlaced()]);

    expect(tracing.spans()).toHaveLength(0);
  });
});

describe('log correlation', () => {
  it('exposes the active trace and span ids', () => {
    withSpan('request', () => {
      const active = trace.getActiveSpan()?.spanContext();

      expect(correlationIdFromActiveSpan()).toBe(active?.traceId);
      expect(traceLogFields()).toEqual({ trace_id: active?.traceId, span_id: active?.spanId });
    });
  });

  it('yields nothing outside of a span', () => {
    expect(correlationIdFromActiveSpan()).toBeUndefined();
    expect(traceLogFields()).toEqual({});
  });
});
