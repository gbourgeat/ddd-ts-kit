import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryErrorReporter } from '@ddd-ts-kit/kernel';
import { eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { expectSpanTree, installTestTracing, type ExpectedSpan, type SpanNode } from '@ddd-ts-kit/tracing/testing';
import type { LogSettings } from '@/platform/observability/create-logger';
import { bookAppointment } from '$test/e2e/support/book-appointment';
import { NETWORK } from '$test/e2e/support/create-credentials';
import type { Listed } from '$test/e2e/support/listed';
import { LogLines } from '$test/e2e/support/log-lines';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import { registerPeople } from '$test/e2e/support/register-people';
import { slotStarting } from '$test/e2e/support/slot-starting';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';
import { StorageOutage } from '$test/e2e/support/storage-outage';
import { storyOf } from '$test/e2e/support/story-of';

describe('One booking, followed from outside: its trace, its log lines, its error report', () => {
  const tracing = installTestTracing();
  const logs = new LogLines();
  const errors = new InMemoryErrorReporter();
  const outage = new StorageOutage();
  const startsAt = slotStarting({ days: 7 });
  let application: RunningApplication;
  let practice: StaffedPractice;
  let paul: HttpClient;
  let correlationId: string;

  beforeAll(async () => {
    application = await startApplication({
      log: jsonLinesInto(logs),
      errors,
      storage: (persistence) => outage.around(persistence),
    });
  });

  afterAll(async () => {
    await application.close();
    tracing.uninstall();
  });

  beforeEach(async () => {
    await application.reset();
    practice = await openStaffedPractice(application, riverside);
    await registerPeople(application, 'paul');
    correlationId = randomUUID();
    // The correlation is given to the booking alone: the requests that wait for its effects start chains of their own.
    paul = await application.as({ id: 'paul', roles: ['patient'] });
  });

  afterEach(() => {
    outage.end();
    errors.clear();
  });

  it('is one trace, from the request to what notification and analytics do of the fact', async () => {
    const trace = await tracing.traceOf(() => bookedAndFollowed());

    expectSpanTree(theBookingIn(trace), storyOfTheBooking(correlationId));
  });

  it('writes the log lines of the request and of its consumer under one correlation id and one trace id', async () => {
    const trace = await tracing.traceOf(() => bookedAndFollowed());
    const lines = logs.of(correlationId);
    const [booking] = theBookingIn(trace);

    expect(lines.map((line) => [line['origin'], line['actorId'], line['message']])).toEqual([
      ['http', 'paul', 'command BookAppointmentCommand succeeded'],
      ['event', 'system:notification.scheduling-appointment-booked', 'mail handed to the development mailer'],
      ['event', 'system:notification.scheduling-appointment-booked', 'command SendNotificationCommand succeeded'],
      ['event', 'system:notification.scheduling-appointment-booked', 'command PlanReminderCommand succeeded'],
    ]);

    expect(new Set(lines.map((line) => line['trace_id']))).toEqual(new Set([booking?.traceId]));
  });

  it('reports an unexpected failure with the trace id of its request, and tells the client nothing of it', async () => {
    outage.begin();

    const trace = await tracing.traceOf(async () => {
      expect(
        expectProblem(await bookAppointment(correlated(), practice, { startsAt }), {
          status: 500,
          code: 'INTERNAL_ERROR',
        }),
      ).not.toHaveProperty('detail');
    });

    const [request] = theBookingIn(trace);

    expectSpanTree(theBookingIn(trace), storyOfTheFailure);

    expect(errors.reports.map(({ error, report }) => ({ error: String(error), ...report }))).toEqual([
      {
        error: 'Error: The storage does not answer.',
        severity: 'error',
        origin: 'http',
        operation: 'BookAppointmentCommand',
        actorId: 'paul',
        tenantId: NETWORK,
        correlationId,
        traceId: request?.traceId,
      },
    ]);

    expect(logs.of(correlationId).filter((line) => line['level'] === 'error')).toMatchObject([
      { message: 'command BookAppointmentCommand failed', trace_id: request?.traceId },
      { message: 'request failed', trace_id: request?.traceId, errorCode: 'INTERNAL_ERROR' },
    ]);
  });

  function correlated(): HttpClient {
    return paul.withHeaders({ 'x-correlation-id': correlationId });
  }

  /** The patient books, then the spec waits for what each consuming context shows of it through the API. */
  async function bookedAndFollowed(): Promise<void> {
    const manager = await application.as({ id: practice.managerId });

    expectStatus(await bookAppointment(correlated(), practice, { startsAt }), 201);

    await eventually(async () =>
      expect(expectStatus(await paul.get<Listed<unknown>>('/notifications'), 200).body.items).toHaveLength(1),
    );

    await eventually(async () =>
      expect(
        expectStatus(await manager.get<Listed<unknown>>('/practices/' + practice.practiceId + '/occupancy'), 200).body
          .items,
      ).toHaveLength(1),
    );
  }
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };

function jsonLinesInto(destination: LogLines): LogSettings {
  return {
    level: 'info',
    format: 'json',
    service: 'scheduling',
    environment: 'test',
    scrubMessages: true,
    destination,
  };
}

/** The trace of the booking as the business reads it, among the traces of the requests that waited for its effects. */
function theBookingIn(trace: readonly SpanNode[]): SpanNode[] {
  return storyOf(trace).filter((span) => span.name === 'POST /appointments');
}

const storyOfTheFailure: ExpectedSpan[] = [
  {
    name: 'POST /appointments',
    kind: 'SERVER',
    status: 'ERROR',
    children: [{ name: 'command BookAppointmentCommand', status: 'ERROR' }],
  },
];

function storyOfTheBooking(correlationId: string): ExpectedSpan[] {
  const followed = { 'app.correlation_id': correlationId, 'app.outcome': 'succeeded' };

  return [
    {
      name: 'POST /appointments',
      kind: 'SERVER',
      attributes: { ...followed, 'app.origin': 'http' },
      children: [
        {
          name: 'command BookAppointmentCommand',
          attributes: { 'app.context': 'scheduling', 'app.outcome': 'succeeded' },
          children: [
            { name: 'repository CalendarRepository.findById' },
            { name: 'repository AppointmentRepository.heldOn' },
            { name: 'repository AppointmentRepository.heldBy' },
            { name: 'repository AppointmentRepository.save' },
            {
              name: 'unit-of-work before-commit',
              children: [
                { name: 'domain-event scheduling.appointment.booked', children: whatFollowsTheFact(followed) },
              ],
            },
          ],
        },
      ],
    },
  ];
}

/** At the end of the unit of work of the command, before its commit: the relationships of the appointment, its confirmation deadline, its publication through the outbox, its entry in the agenda. */
function whatFollowsTheFact(followed: Readonly<Record<string, string>>): ExpectedSpan[] {
  return [
    {
      name: 'handler AppointmentBookedEventHandler',
      children: [{ name: 'repository SchedulingRelationships.recordAppointment' }],
    },
    // A booking that needs no confirmation arms no deadline: the step of the process decides nothing.
    { name: 'handler ConfirmationDeadlineOnBookedEventHandler' },
    {
      name: 'handler AppointmentBookedPublisher',
      children: [
        {
          name: 'outbox append scheduling.appointment.booked',
          children: [
            { name: 'publish scheduling.appointment.booked', kind: 'PRODUCER', children: theConsumers(followed) },
          ],
        },
      ],
    },
    { name: 'repository Agenda.written' },
  ];
}

/** After the response, by the relay: each consumer continues the trace, in its own context, under the correlation of the request. */
function theConsumers(followed: Readonly<Record<string, string>>): ExpectedSpan[] {
  const consumed = { ...followed, 'app.origin': 'event' };

  return [
    {
      name: 'process notification.scheduling-appointment-booked',
      kind: 'CONSUMER',
      attributes: { ...consumed, 'app.context': 'notification' },
      children: [theNotification, whatFollowsTheNotification],
    },
    {
      name: 'process analytics.outcomes',
      kind: 'CONSUMER',
      attributes: { ...consumed, 'app.context': 'analytics' },
      children: [{ name: 'repository OutcomeRegister.written' }],
    },
  ];
}

const theNotification: ExpectedSpan = {
  name: 'command SendNotificationCommand',
  attributes: { 'app.context': 'notification', 'app.outcome': 'succeeded' },
  children: [
    { name: 'repository NotificationRepository.findByCause' },
    { name: 'repository Contacts.get' },
    { name: 'external Mailer.deliver' },
    { name: 'repository NotificationRepository.save' },
  ],
};

/** The unit of work is the consumer's, which the command joined: the fact is dispatched at its end, before the mark of the event and the notification commit together. */
const whatFollowsTheNotification: ExpectedSpan = {
  name: 'unit-of-work before-commit',
  children: [
    {
      name: 'domain-event notification.notification.sent',
      children: [
        {
          name: 'handler NotificationSentEventHandler',
          children: [
            {
              name: 'command PlanReminderCommand',
              children: [
                { name: 'repository ReminderRepository.findByAppointment' },
                { name: 'repository ReminderRepository.save' },
              ],
            },
          ],
        },
      ],
    },
  ],
};
