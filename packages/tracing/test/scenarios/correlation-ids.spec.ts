import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTracingConfiguration } from '../../src/index.js';
import { installTestTracing, type SpanNode, type TestTracing } from '../../src/testing.js';
import { aClinic } from '../support/clinic/a-clinic.js';

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

beforeEach(() => resetTracingConfiguration());

function everySpan(spans: readonly SpanNode[]): SpanNode[] {
  return spans.flatMap((span) => [span, ...everySpan(span.children)]);
}

describe('pivoting between the trace, the logs, the audit trail and the error tracker', () => {
  it('finds one correlation id and one trace id in all four, for one action', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    const [request] = trace;
    const correlationId = request?.attributes['app.correlation_id'];
    const consumers = everySpan(trace).filter((span) => span.kind === 'CONSUMER');
    const log = clinic.logger.entries.find((entry) => entry.message === 'confirmation sent');

    expect(correlationId).toEqual(expect.any(String));
    expect(consumers.map((span) => span.attributes['app.correlation_id'])).toEqual([correlationId, correlationId]);
    expect(log?.fields).toMatchObject({ correlationId, trace_id: request?.traceId, origin: 'event' });
    expect(clinic.audit.entries.map((entry) => entry.correlationId)).toEqual([correlationId, correlationId, correlationId]);
    expect(clinic.audit.entries.map((entry) => entry.action)).toEqual(['BookAppointment', 'SendBookingConfirmation', 'RecordBooking']);
  });

  it('gives the error report of a failed action the ids of its trace, and the audit entry the same correlation', async () => {
    const clinic = await aClinic();

    const [request] = await tracing.traceOf(() => clinic.book('unreachable'));
    const correlationId = request?.attributes['app.correlation_id'];
    const [reported] = clinic.errors.reports;

    expect(reported?.report.traceId).toBe(request?.traceId);
    expect(reported?.report.correlationId).toBe(correlationId);
    expect(clinic.audit.entries.at(-1)).toMatchObject({ correlationId, outcome: 'failed' });
  });

  it('names nothing personal on a span: no actor, no tenant, no payload, no message', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    const keys = new Set(everySpan(trace).flatMap((span) => Object.keys(span.attributes)));

    expect([...keys].filter((key) => /actor|tenant|user|payload|message\.body|exception/.test(key))).toEqual([]);
    expect(JSON.stringify(trace)).not.toContain('anonymous');
  });
});
