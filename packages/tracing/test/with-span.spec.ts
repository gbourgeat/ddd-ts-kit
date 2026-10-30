import { SpanStatusCode, trace } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withSpan } from '../src';
import { setupTracing, type TestTracing } from './support/setup-tracing';

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

  it('ends the span and marks it failed when the function throws at once, whatever it throws', () => {
    const failure: unknown = 'not even an error';

    expect(() =>
      withSpan('startup.check', () => {
        throw failure;
      }),
    ).toThrow('not even an error');

    const span = tracing.span('startup.check');

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.attributes).toEqual({});
    expect(span.ended).toBe(true);
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
