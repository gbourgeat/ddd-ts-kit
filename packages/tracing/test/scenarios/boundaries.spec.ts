import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTracingConfiguration, withSpan } from '../../src/index.js';
import { expectSpanTree, installTestTracing, type ExpectedSpan, type TestTracing } from '../../src/testing.js';
import { aClinic } from '../support/clinic/a-clinic.js';
import { RedeliveringBus } from '../support/clinic/redelivering-bus.js';
import { MailGateway, RecordingMailGateway } from '../support/clinic/downstream.js';
import { bookingTree, confirmationTree, recordingTree } from '../support/clinic/trees.js';

let tracing: TestTracing;

beforeAll(() => {
  tracing = installTestTracing();
});

afterAll(() => tracing.uninstall());

beforeEach(() => resetTracingConfiguration());

const failedConfirmation = (attempt: number, outcome: string): ExpectedSpan => ({
  name: 'process notification.appointment-booked',
  kind: 'CONSUMER',
  status: 'ERROR',
  attributes: {
    'messaging.system': 'test-broker',
    'app.messaging.source': 'queue.scheduling.appointment.booked',
    'app.messaging.attempt': attempt,
    'app.messaging.redelivered': attempt > 1 ? true : undefined,
    'app.error.code': 'MAIL_REFUSED',
    'error.type': 'MailRefused',
    'app.outcome': outcome,
  },
  children: [
    {
      name: 'command SendBookingConfirmation',
      status: 'ERROR',
      attributes: { 'app.outcome': 'failed', 'app.error.code': 'MAIL_REFUSED' },
      children: [
        { name: 'external MailGateway.send', status: 'ERROR', attributes: { 'app.error.code': 'MAIL_REFUSED' } },
      ],
    },
  ],
});

const publication = (consumers: readonly ExpectedSpan[]): ExpectedSpan => ({
  name: 'publish scheduling.appointment.booked',
  kind: 'PRODUCER',
  attributes: { 'messaging.system': 'test-broker' },
  children: consumers,
});

async function aClinicWhoseMailRefuses(
  times: number,
): Promise<Awaited<ReturnType<typeof aClinic>> & { bus: RedeliveringBus }> {
  const bus = new RedeliveringBus(3);
  const clinic = await aClinic({ bus });
  const mail = clinic.app.resolve(MailGateway);

  if (mail instanceof RecordingMailGateway) {
    mail.refusals = times;
  }

  return { ...clinic, bus };
}

describe('a consumer that fails, is delivered the event again, and succeeds', () => {
  it('has one span per delivery, the redelivery named as such, in the trace of the action', async () => {
    const clinic = await aClinicWhoseMailRefuses(1);

    const trace = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    expectSpanTree(trace, [
      bookingTree([publication([failedConfirmation(1, 'failed'), confirmationTree(2), recordingTree()])]),
    ]);

    expect(clinic.errors.reports).toEqual([]);
  });

  it('marks the delivery after which the provider gives the event up, with the code only', async () => {
    const clinic = await aClinicWhoseMailRefuses(3);

    const trace = await tracing.traceOf(async () => {
      await clinic.book('09:00');
      await clinic.relay.tick();
    });

    const deliveries = [
      failedConfirmation(1, 'failed'),
      failedConfirmation(2, 'failed'),
      failedConfirmation(3, 'dead-lettered'),
    ];

    expectSpanTree(trace, [bookingTree([publication([...deliveries, recordingTree()])])]);
    expect(clinic.bus.dead).toEqual(['id-2 for 0']);
    expect(JSON.stringify(trace)).not.toContain('jane');
  });
});

describe('a scheduled job', () => {
  it('is one trace per run: the job at the root, with the instant it was due, and the command it sends', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(async () => {
      await clinic.scheduler.runNow('scheduling.send-reminders');
      await clinic.scheduler.runNow('scheduling.send-reminders');
    });

    const run = (correlationId: string): ExpectedSpan => ({
      name: 'job scheduling.send-reminders',
      kind: 'INTERNAL',
      attributes: {
        'app.job.name': 'scheduling.send-reminders',
        'app.context': 'scheduling',
        'app.job.scheduled_at': '2026-03-02T09:00:00.000Z',
        'app.job.attempt': 1,
        'app.origin': 'schedule',
        'app.correlation_id': correlationId,
        'app.outcome': 'succeeded',
      },
      children: [
        {
          name: 'command SendReminders',
          attributes: { 'app.context': 'scheduling' },
          children: [{ name: 'repository AppointmentRepository.findOverlapping' }],
        },
      ],
    });

    expectSpanTree(trace, [run('run-1'), run('run-2')]);
    expect(trace[0]?.traceId).not.toBe(trace[1]?.traceId);
  });

  it('does not continue the trace of whatever started it', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(() =>
      withSpan('an unrelated request', () => clinic.scheduler.runNow('scheduling.send-reminders')),
    );

    expect(trace.map((span) => span.name)).toEqual(['an unrelated request', 'job scheduling.send-reminders']);
    expect(trace[0]?.children).toEqual([]);
  });
});

describe('a query', () => {
  it('is the request, the use case named as a query, and its read', async () => {
    const clinic = await aClinic();

    const trace = await tracing.traceOf(() => clinic.read('id-1'));

    expectSpanTree(trace, [
      {
        name: 'GET /appointments/:id',
        kind: 'SERVER',
        attributes: {
          'http.route': '/appointments/:id',
          'app.operation': 'getAppointment',
          'http.response.status_code': 204,
        },
        children: [
          {
            name: 'query GetAppointment',
            attributes: { 'app.use_case.kind': 'query', 'app.context': 'scheduling', 'app.outcome': 'succeeded' },
            children: [{ name: 'repository AppointmentRepository.findById' }],
          },
        ],
      },
    ]);
  });
});
