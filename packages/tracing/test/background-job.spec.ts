import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BackgroundJobExecution } from '@ddd-ts-kit/kernel';
import { traceApplication, withSpan } from '../src/index.js';
import { setupTracing, type TestTracing } from './support/setup-tracing.js';

const execution = (traceparent: string | undefined): BackgroundJobExecution => ({
  jobId: 'job-1',
  attempt: 2,
  enqueuedAt: new Date('2026-03-02T10:00:00.000Z'),
  startedAt: new Date('2026-03-02T10:00:05.000Z'),
  checkpoint: undefined,
  signal: new AbortController().signal,
  ...(traceparent === undefined ? {} : { traceparent }),
  saveCheckpoint: () => Promise.resolve(),
  reportProgress: () => Promise.resolve(),
});

describe('a traced background job', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  it('continues the trace of the work that enqueued it, one span per attempt', async () => {
    const traced = traceApplication();
    const traceparent = withSpan('POST /statements', () => traced.traceparent());

    const run = traced.backgroundJob(
      async () => {
        await withSpan('command CompileStatements', async () => undefined);
      },
      { name: 'billing.compile-statements', context: 'billing' },
    );

    await run({ month: '2026-02' }, execution(traceparent));

    const request = tracing.span('POST /statements');
    const job = tracing.span('job billing.compile-statements');
    const command = tracing.span('command CompileStatements');

    expect(job.spanContext().traceId).toBe(request.spanContext().traceId);
    expect(job.parentSpanContext?.spanId).toBe(request.spanContext().spanId);
    expect(command.parentSpanContext?.spanId).toBe(job.spanContext().spanId);

    expect(job.attributes).toMatchObject({
      'app.job.name': 'billing.compile-statements',
      'app.context': 'billing',
      'app.job.id': 'job-1',
      'app.job.attempt': 2,
      'app.outcome': 'succeeded',
    });
  });

  it('starts a trace of its own when the job carries none', async () => {
    const run = traceApplication().backgroundJob(() => Promise.resolve(), {
      name: 'billing.compile-statements',
      context: 'billing',
    });

    await run({}, execution(undefined));

    expect(tracing.span('job billing.compile-statements').parentSpanContext).toBe(undefined);
  });
});
