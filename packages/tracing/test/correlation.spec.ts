import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  InMemoryErrorReporter,
  InMemoryEventBus,
  executionContext,
  inEventScope,
  type Actor,
  type ExecutionContext,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import {
  CORRELATION_ID_ATTRIBUTE,
  LocalRootTracker,
  ORIGIN_ATTRIBUTE,
  configureTracing,
  resetTracingConfiguration,
  traceDependency,
  traceLogFields,
  tracedErrorReporter,
  tracedSubscriber,
  withSpan,
} from '../src';
import { setupTracing, type TestTracing } from './support/setup-tracing';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: { email: 'ada@example.test' } };
const request: ExecutionContext = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

const gateway = () => traceDependency({ ping: async (): Promise<void> => {} }, { kind: 'gateway', className: 'Ping' });

describe('with an execution scope', () => {
  const scope = new AsyncLocalStorageExecutionScope();
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
    configureTracing({ executionScope: scope });
  });

  afterEach(() => {
    tracing.teardown();
    resetTracingConfiguration();
  });

  it('names the correlation and the origin on the local root, once the scope is open inside it', async () => {
    const ping = gateway();

    await withSpan('GET /orders', () => scope.run(request, () => ping.ping()));

    expect(tracing.span('GET /orders').attributes).toEqual({
      [CORRELATION_ID_ATTRIBUTE]: 'corr-1',
      [ORIGIN_ATTRIBUTE]: 'http',
    });

    expect(tracing.span('gateway Ping.ping').attributes).not.toHaveProperty(CORRELATION_ID_ATTRIBUTE);
  });

  it('names them on a root started inside the scope', async () => {
    await scope.run(request, () => withSpan('job', async () => {}));

    expect(tracing.span('job').attributes).toMatchObject({ [CORRELATION_ID_ATTRIBUTE]: 'corr-1' });
  });

  it('never writes who acts, nor for which tenant', async () => {
    const ping = gateway();

    await withSpan('GET /orders', () => scope.run(request, () => ping.ping()));

    const recorded = JSON.stringify(tracing.spans().map((span) => span.attributes));

    expect(recorded).not.toContain('ada');
    expect(recorded).not.toContain('acme');
  });

  it('writes nothing on a root that ended before the work under it reached the scope', async () => {
    const ping = gateway();
    let later: Promise<void> = Promise.resolve();

    withSpan('fire-and-forget', () => {
      later = scope.run(request, () => Promise.resolve().then(() => ping.ping()));
    });

    await later;

    expect(tracing.span('fire-and-forget').attributes).not.toHaveProperty(CORRELATION_ID_ATTRIBUTE);
    expect(tracing.span('gateway Ping.ping').ended).toBe(true);
  });

  it('leaves a root alone when no work was in progress under it', async () => {
    const ping = gateway();

    await withSpan('startup', () => ping.ping());

    expect(tracing.span('startup').attributes).toEqual({});
  });

  it('names the correlation of a consumed event on its process span', async () => {
    const bus = new InMemoryEventBus();
    const ping = gateway();

    const event: IntegrationEvent = {
      id: 'evt-1',
      type: 'ordering.order.placed',
      version: 1,
      occurredAt: '2026-03-01T10:00:00.000Z',
      payload: {},
      correlationId: 'corr-9',
    };

    tracedSubscriber(bus).subscribe(
      event.type,
      inEventScope(scope, { consumer: 'billing.invoice' }, () => ping.ping()),
    );

    await bus.publish([event]);

    expect(tracing.span('process ordering.order.placed').attributes).toMatchObject({
      [CORRELATION_ID_ATTRIBUTE]: 'corr-9',
      [ORIGIN_ATTRIBUTE]: 'event',
    });
  });

  it('merges the log fields of the execution context with those of the span', async () => {
    const fields = await withSpan('GET /orders', () => scope.run(request, async () => traceLogFields()));

    expect(fields).toEqual({
      correlationId: 'corr-1',
      origin: 'http',
      actorId: 'ada',
      tenantId: 'acme',
      trace_id: tracing.span('GET /orders').spanContext().traceId,
      span_id: tracing.span('GET /orders').spanContext().spanId,
    });
  });

  it('gives the log fields of the execution context alone outside of a span', () => {
    expect(scope.run(request, () => traceLogFields())).toEqual({
      correlationId: 'corr-1',
      origin: 'http',
      actorId: 'ada',
      tenantId: 'acme',
    });
  });
});

describe('without a configured execution scope', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing([new LocalRootTracker()]);
  });

  afterEach(() => {
    tracing.teardown();
  });

  it('writes no correlation attribute', async () => {
    const scope = new AsyncLocalStorageExecutionScope();

    await scope.run(request, () => withSpan('job', async () => {}));

    expect(tracing.span('job').attributes).toEqual({});
  });

  it('merges the log fields of the scope it is handed', () => {
    const scope = new AsyncLocalStorageExecutionScope();

    expect(scope.run(request, () => traceLogFields(scope))).toMatchObject({ correlationId: 'corr-1' });
    expect(traceLogFields(scope)).toEqual({});
  });
});

describe('tracedErrorReporter', () => {
  let tracing: TestTracing;

  beforeEach(() => {
    tracing = setupTracing();
  });

  afterEach(() => tracing.teardown());

  it('names the active trace on a report that names none, and flushes the reporter it decorates', async () => {
    const reporter = new InMemoryErrorReporter();
    const traced = tracedErrorReporter(reporter);
    const failure = new Error('boom');

    withSpan('job', () => {
      traced.report(failure, { severity: 'error', origin: 'process', operation: 'job' });
    });

    expect(reporter.reports[0]?.report.traceId).toBe(tracing.span('job').spanContext().traceId);
    await expect(traced.flush(100)).resolves.toBe(true);
  });
});
