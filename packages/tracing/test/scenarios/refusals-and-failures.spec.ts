import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTracingConfiguration } from '../../src/index.js';
import { expectSpanTree, installTestTracing, type TestTracing } from '../../src/testing.js';
import { aClinic } from '../support/clinic/a-clinic.js';
import { AppointmentRepository, InMemoryAppointmentRepository } from '../support/clinic/scheduling.js';

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

beforeEach(() => resetTracingConfiguration());

describe('a request refused by authorization', () => {
  it('shows the refusal and its code on the request, and no use case: it never started', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(() => clinic.book('forbidden'));

    expectSpanTree(trace, [
      {
        name: 'POST /appointments',
        kind: 'SERVER',
        status: 'UNSET',
        attributes: { 'http.response.status_code': 403, 'app.error.code': 'FORBIDDEN', 'app.outcome': 'refused' },
      },
    ]);
  });
});

describe('a business refusal', () => {
  it('is an answer, not an error: the use case says refused and the code', async () => {
    const clinic = await aClinic();

    await clinic.book('09:00');

    const trace = await tracing.traceOf(() => clinic.book('09:00'));

    expectSpanTree(trace, [
      {
        name: 'POST /appointments',
        status: 'UNSET',
        attributes: { 'http.response.status_code': 422, 'app.error.code': 'SLOT_TAKEN', 'app.outcome': 'refused' },
        children: [
          {
            name: 'command BookAppointment',
            status: 'UNSET',
            attributes: { 'app.outcome': 'refused', 'app.error.code': 'SLOT_TAKEN', 'error.type': undefined },
            children: [{ name: 'repository AppointmentRepository.findOverlapping' }],
          },
        ],
      },
    ]);

    expect(clinic.errors.reports).toEqual([]);
  });
});

describe('an unexpected error', () => {
  it('marks every span it crossed as an error, by class and code, never by message', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(() => clinic.book('unreachable'));

    expectSpanTree(trace, [
      {
        name: 'POST /appointments',
        status: 'ERROR',
        attributes: { 'http.response.status_code': 500, 'app.error.code': 'INTERNAL_ERROR', 'app.outcome': 'failed' },
        children: [
          {
            name: 'command BookAppointment',
            status: 'ERROR',
            attributes: { 'app.outcome': 'failed', 'error.type': 'TypeError' },
            children: [
              { name: 'repository AppointmentRepository.findOverlapping' },
              {
                name: 'repository AppointmentRepository.save',
                status: 'ERROR',
                attributes: { 'error.type': 'TypeError' },
              },
            ],
          },
        ],
      },
    ]);

    expect(JSON.stringify(trace)).not.toContain('db.internal');
  });

  it('is reported once, with the trace id and the correlation id of the request', async () => {
    const clinic = await aClinic();

    const [request] = await tracing.traceOf(() => clinic.book('unreachable'));

    expect(clinic.errors.reports).toHaveLength(1);

    expect(clinic.errors.reports[0]?.report).toMatchObject({
      operation: 'BookAppointment',
      traceId: request?.traceId,
      correlationId: request?.attributes['app.correlation_id'],
    });
  });

  it('is reported with its trace when it fails a job, though the report is made once the run is over', async () => {
    const clinic = await aClinic();

    const appointments = clinic.app.resolve(AppointmentRepository);

    if (appointments instanceof InMemoryAppointmentRepository) {
      appointments.unreachable = true;
    }

    const [run] = await tracing.traceOf(() => clinic.scheduler.runNow('scheduling.send-reminders'));

    expect(run).toMatchObject({ name: 'job scheduling.send-reminders', status: 'ERROR' });
    expect(clinic.errors.reports).toHaveLength(1);
    expect(clinic.errors.reports[0]?.report).toMatchObject({ traceId: run?.traceId, correlationId: 'run-1' });
  });
});
