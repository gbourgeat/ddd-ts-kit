import { SpanStatusCode, trace } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { traceUseCase, withSpan } from '../src/index.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';

describe('traceUseCase', () => {
  it('traces a handler as a use case of its context', async () => {
    const tracing = setupTracing();

    class PlaceOrderHandler {
      async execute(): Promise<string> {
        return 'order-1';
      }
    }

    await traceUseCase(new PlaceOrderHandler(), { context: 'ordering' }).execute();

    const span = tracing.span('use-case.PlaceOrderHandler.execute');

    expect(span.attributes['app.dependency.kind']).toBe('use-case');
    expect(span.attributes['app.context']).toBe('ordering');
    tracing.teardown();
  });
});

describe('withSpan', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  it('runs a synchronous function in a span carrying the given attributes', () => {
    const result = withSpan('startup.migrations', () => trace.getActiveSpan() !== undefined, {
      'app.step': 'migrate',
    });

    expect(result).toBe(true);
    expect(tracing.span('startup.migrations').attributes).toEqual({ 'app.step': 'migrate' });
  });

  it('ends the span when the promise settles and scrubs the failure', async () => {
    await expect(
      withSpan('job', async () => {
        throw new RangeError('user 42 is out of range');
      }),
    ).rejects.toThrow(RangeError);

    const span = tracing.span('job');

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.attributes).toEqual({ 'error.type': 'RangeError' });
    expect(span.events).toHaveLength(0);
  });
});
