import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTracingConfiguration } from '../../src/index.js';
import { expectSpanTree, installTestTracing, type ExpectedSpan, type SpanNode, type TestTracing } from '../../src/testing.js';
import { aClinic } from '../support/clinic/a-clinic.js';
import { bookingTree, confirmationTree, recordingTree } from '../support/clinic/trees.js';

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

beforeEach(() => resetTracingConfiguration());

const publication = (consumers: readonly ExpectedSpan[]): ExpectedSpan => ({
  name: 'publish scheduling.appointment.booked',
  kind: 'PRODUCER',
  attributes: { 'messaging.system': 'in-memory', 'messaging.operation.type': 'send', 'messaging.destination.name': 'scheduling.appointment.booked', 'messaging.message.id': 'id-2' },
  children: consumers,
});

function traceIdsOf(spans: readonly SpanNode[]): string[] {
  return [...new Set(spans.flatMap((span) => [span.traceId, ...traceIdsOf(span.children)]))];
}

describe('a command with a repository and a domain event handler', () => {
  it('is one trace: the request, the use case, the save, the event it announced and its handler', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(() => clinic.book('09:00'));

    expectSpanTree(trace, [bookingTree()]);
    expect(traceIdsOf(trace)).toHaveLength(1);
  });
});

describe('the same action crossing two bounded contexts through the outbox', () => {
  it('continues the trace of the request when the relay publishes later, outside of any request', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    expectSpanTree(trace, [bookingTree([publication([confirmationTree(), recordingTree()])])]);
    expect(traceIdsOf(trace)).toHaveLength(1);
  });

  it('stores the context of the request with the outbox record, for a relay of another process to find it', async () => {
    const clinic = await aClinic();

    const [request] = await tracing.traceOf(() => clinic.book('09:00'));
    const [record] = clinic.store.records();

    expect(record?.event.traceparent).toMatch(new RegExp(`^00-${request?.traceId}-[0-9a-f]{16}-01$`));
    expect(record?.event.correlationId).toBe(request?.attributes['app.correlation_id']);
  });

  it('makes no span for a relay tick that finds nothing to publish', async () => {
    const clinic = await aClinic();

    expect(await tracing.traceOf(() => clinic.relay.tick())).toEqual([]);

    await clinic.book('09:00');
    await clinic.relay.tick();

    expect(await tracing.traceOf(() => clinic.relay.tick())).toEqual([]);
  });

  it('starts one linked trace per consumer when the application asks for links', async () => {
    const clinic = await aClinic({ consumers: 'link' });

    const trace = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    const [request, notification, analytics] = trace;

    expectSpanTree(trace, [bookingTree([publication([])]), confirmationTree(), recordingTree()]);
    expect(traceIdsOf(trace)).toHaveLength(3);
    expect(notification?.links).toEqual([request?.traceId]);
    expect(analytics?.links).toEqual([request?.traceId]);
  });
});
