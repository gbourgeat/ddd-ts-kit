import { SpanStatusCode } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalRootTracker, resetTracingConfiguration, traceDependency } from '../src';
import { InsufficientFunds } from './support/insufficient-funds';
import { setupTracing, type TestTracing } from './support/setup-tracing';
import { tracedRepository as repository } from './support/traced-repository';

describe('traceDependency, a failing call', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
  });

  afterEach(() => {
    tracing.teardown();
    resetTracingConfiguration();
  });

  it('never records arguments, return values or the error message', async () => {
    const wrapped = repository();

    await wrapped.findBalance('acc-1');
    await expect(wrapped.debit('acc-1', 5000)).rejects.toThrow();

    const recorded = JSON.stringify(tracing.spans().map((span) => [span.attributes, span.events, span.status]));

    expect(recorded).not.toContain('acc-1');
    expect(recorded).not.toContain('5000');
    expect(recorded).not.toContain('100');
    expect(recorded).not.toContain('lacks');
  });

  it('reports a domain error by class name and code, and rethrows it untouched', async () => {
    const failure = await repository()
      .debit('acc-1', 5000)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InsufficientFunds);
    const span = tracing.span('repository AccountRepository.debit');

    expect(span.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span.attributes['error.type']).toBe('InsufficientFunds');
    expect(span.attributes['app.error.code']).toBe('INSUFFICIENT_FUNDS');
    expect(span.events).toHaveLength(0);
  });

  it('reports an infrastructure fault by class name only', async () => {
    await expect(repository().crash()).rejects.toThrow(TypeError);

    const span = tracing.span('repository AccountRepository.crash');

    expect(span.attributes['error.type']).toBe('TypeError');
    expect(span.attributes).not.toHaveProperty('app.error.code');
  });

  it('keeps an identifier-shaped code of any error and drops any other code', async () => {
    const wrapped = repository();

    await expect(wrapped.rejectWithDriverCode()).rejects.toThrow();
    await expect(wrapped.rejectWithUnsafeCode()).rejects.toThrow();

    expect(tracing.span('repository AccountRepository.rejectWithDriverCode').attributes['app.error.code']).toBe(
      'ECONNREFUSED',
    );

    expect(tracing.span('repository AccountRepository.rejectWithUnsafeCode').attributes).not.toHaveProperty(
      'app.error.code',
    );
  });

  it('omits error.type when the class name is not identifier-shaped', async () => {
    const Weird = { 'not valid': class extends Error {} }['not valid'];

    const gateway = traceDependency(
      {
        async call(): Promise<void> {
          throw new Weird('secret');
        },
      },
      { kind: 'gateway', className: 'Inline' },
    );

    await expect(gateway.call()).rejects.toThrow();

    expect(tracing.span('gateway Inline.call').attributes).not.toHaveProperty('error.type');
  });
});
