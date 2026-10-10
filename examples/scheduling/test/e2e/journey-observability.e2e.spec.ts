import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryErrorReporter } from '@ddd-ts-kit/kernel';
import { eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { expectSpanTree, installTestTracing, type ExpectedSpan, type SpanNode } from '@ddd-ts-kit/tracing/testing';
import { bookAppointment } from './support/book-appointment.js';
import type { Listed } from './support/listed.js';
import { LogLines } from './support/log-lines.js';
import { openStaffedPractice } from './support/open-staffed-practice.js';
import { registerPeople } from './support/register-people.js';
import { slotStarting } from './support/slot-starting.js';
import type { StaffedPractice } from './support/staffed-practice.js';
import { startApplication, type RunningApplication } from './support/start-application.js';
import { StorageOutage } from './support/storage-outage.js';
import { storyOf } from './support/story-of.js';

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
      log: { level: 'info', format: 'json', service: 'scheduling', environment: 'test', scrubMessages: true, destination: logs },
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
      ['event', 'system:notification.scheduling-appointment-booked', 'command PlanReminderCommand succeeded'],
      ['event', 'system:notification.scheduling-appointment-booked', 'command SendNotificationCommand succeeded'],
    ]);

    expect(new Set(lines.map((line) => line['trace_id']))).toEqual(new Set([booking?.traceId]));
  });

  it('reports an unexpected failure with the trace id of its request, and tells the client nothing of it', async () => {
    outage.begin();

    const trace = await tracing.traceOf(async () => {
      expect(expectProblem(await bookAppointment(correlated(), practice, { startsAt }), { status: 500, code: 'INTERNAL_ERROR' })).not.toHaveProperty('detail');
    });

    const [request] = theBookingIn(trace);

    expectSpanTree(theBookingIn(trace), [{ name: 'POST /appointments', kind: 'SERVER', status: 'ERROR', children: [{ name: 'command BookAppointmentCommand', status: 'ERROR' }] }]);

    expect(errors.reports.map(({ error, report }) => ({ error: String(error), ...report }))).toEqual([
      { error: 'Error: The storage does not answer.', severity: 'error', origin: 'http', operation: 'BookAppointmentCommand', actorId: 'paul', correlationId, traceId: request?.traceId },
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
    await eventually(async () => expect(expectStatus(await paul.get<Listed<unknown>>('/notifications'), 200).body.items).toHaveLength(1));
    await eventually(async () => expect(expectStatus(await manager.get<Listed<unknown>>('/practices/' + practice.practiceId + '/occupancy'), 200).body.items).toHaveLength(1));
  }
});

const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };

/** The trace of the booking as the business reads it, among the traces of the requests that waited for its effects. */
function theBookingIn(trace: readonly SpanNode[]): SpanNode[] {
  return storyOf(trace).filter((span) => span.name === 'POST /appointments');
}

function storyOfTheBooking(correlationId: string): ExpectedSpan[] {
  const followed = { 'app.correlation_id': correlationId, 'app.outcome': 'succeeded' };

  return [
    {
      name: 'POST /appointments', kind: 'SERVER', attributes: { ...followed, 'app.origin': 'http' },
      children: [
        {
          name: 'command BookAppointmentCommand', attributes: { 'app.context': 'scheduling', 'app.outcome': 'succeeded' },
          children: [
            { name: 'repository CalendarRepository.findById' },
            { name: 'repository AppointmentRepository.heldOn' },
            { name: 'repository AppointmentRepository.heldBy' },
            { name: 'repository AppointmentRepository.save', children: [{ name: 'domain-event scheduling.appointment.booked', children: whatFollowsTheFact(followed) }] },
          ],
        },
      ],
    },
  ];
}

/** Inside the command: the relationships of the appointment, its publication through the outbox, its entry in the agenda. */
function whatFollowsTheFact(followed: Readonly<Record<string, string>>): ExpectedSpan[] {
  return [
    { name: 'handler AppointmentBookedEventHandler', children: [{ name: 'external SchedulingRelationships.recordAppointment' }] },
    {
      name: 'handler AppointmentBookedPublisher',
      children: [{ name: 'outbox append scheduling.appointment.booked', children: [{ name: 'publish scheduling.appointment.booked', kind: 'PRODUCER', children: theConsumers(followed) }] }],
    },
    { name: 'repository Agenda.written' },
  ];
}

/** After the response, by the relay: each consumer continues the trace, in its own context, under the correlation of the request. */
function theConsumers(followed: Readonly<Record<string, string>>): ExpectedSpan[] {
  const consumed = { ...followed, 'app.origin': 'event' };

  return [
    { name: 'process notification.scheduling-appointment-booked', kind: 'CONSUMER', attributes: { ...consumed, 'app.context': 'notification' }, children: [theNotification] },
    { name: 'process analytics.outcomes', kind: 'CONSUMER', attributes: { ...consumed, 'app.context': 'analytics' }, children: [{ name: 'repository OutcomeRegister.written' }] },
    {
      name: 'process analytics.occupancy', kind: 'CONSUMER', attributes: { ...consumed, 'app.context': 'analytics' },
      children: [{ name: 'repository OutcomeRegister.get' }, { name: 'repository OutcomeRegister.list' }, { name: 'repository OccupancyRegister.written' }],
    },
  ];
}

const theNotification: ExpectedSpan = {
  name: 'command SendNotificationCommand', attributes: { 'app.context': 'notification', 'app.outcome': 'succeeded' },
  children: [
    { name: 'repository NotificationRepository.findByCause' },
    { name: 'repository Contacts.get' },
    { name: 'external Mailer.deliver' },
    {
      name: 'repository NotificationRepository.save',
      children: [
        {
          name: 'domain-event notification.notification.sent',
          children: [
            {
              name: 'handler NotificationSentEventHandler',
              children: [{ name: 'command PlanReminderCommand', children: [{ name: 'repository ReminderRepository.findByAppointment' }, { name: 'repository ReminderRepository.save' }] }],
            },
          ],
        },
      ],
    },
  ],
};
