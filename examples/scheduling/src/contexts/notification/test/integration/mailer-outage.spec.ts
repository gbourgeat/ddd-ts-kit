import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, defineContextModule, fake } from '@ddd-ts-kit/di';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import { DeadLetterReports, ProcessedEventStore, UnitOfWork, systemActor } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { personRegisteredV1 } from '@/contexts/identity/published-language';
import { appointmentBookedV1 } from '@/contexts/scheduling/published-language';
import { notificationPermissions } from '@/contexts/notification/notification.permissions';
import { PlanReminderCommand } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';
import { SendDueRemindersCommand } from '@/contexts/notification/application/commands/send-due-reminders/send-due-reminders.command';
import { Mailer } from '@/contexts/notification/application/ports/mailer.port';
import { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { FakeMailer } from '@/contexts/notification/test/fakes/mailer.fake';

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { system: Object.values(notificationPermissions) },
    systemRole: 'system',
  }),
});

const operator = systemActor('notification.spec');
const NOW = new Date('2026-01-09T09:00:00.000Z');
const startsAt = '2026-01-10T09:00:00.000Z';

/** The network every fact of this spec happened in: what the publisher of the application stamps on its events. */
const NETWORK = 'north';

const booked = {
  ...appointmentBookedV1.create(
    {
      appointmentId: 'appointment-1',
      calendarId: 'calendar-1',
      practiceId: 'practice-1',
      practitionerId: 'practitioner-1',
      patientId: 'patient-1',
      startsAt,
      endsAt: '2026-01-10T09:30:00.000Z',
      day: '2026-01-10',
      status: 'booked',
    },
    { id: 'event-booked', occurredAt: new Date('2026-01-02T08:00:00.000Z') },
  ),
  tenantId: NETWORK,
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
});

describe('When the mailer fails on every attempt', () => {
  it('delivers the event again, then buries it and reports it, and keeps nothing of the notification', async () => {
    const { application, mailer, relay } = await arrange();

    mailer.failAlwaysWith(new Error('provider unreachable'));
    await database.persistence.unitOfWork.run(() => new OutboxPublisher(database.persistence.outbox).publish([booked]));
    await relay.tick();
    application.clock.advance(60 * 60 * 1000);
    await relay.tick();
    application.clock.advance(60 * 60 * 1000);
    await relay.tick();

    expect(mailer.attempts).toBe(3);
    expect(await database.persistence.outbox.stats()).toMatchObject({ dead: 1 });

    expect(application.errors.reports.filter((reported) => reported.report.origin === 'event')).toMatchObject([
      { report: { operation: 'scheduling.appointment.booked', correlationId: 'event-booked', severity: 'error' } },
    ]);

    expect(await application.get(NotificationRepository).findByCause('event-booked', 'patient-1')).toBeUndefined();
    expect(await application.get(ReminderRepository).findByAppointment('appointment-1')).toBeUndefined();
  });

  it('sends the notification once, and plans the reminder, when the mailer recovers before the event is buried', async () => {
    const { application, mailer, relay } = await arrange();

    mailer.failNextWith(new Error('provider unreachable'));
    await database.persistence.unitOfWork.run(() => new OutboxPublisher(database.persistence.outbox).publish([booked]));
    await relay.tick();
    application.clock.advance(60 * 60 * 1000);
    await relay.tick();

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'confirmation', appointmentId: 'appointment-1' },
    ]);

    expect(await database.persistence.outbox.stats()).toMatchObject({ dead: 0 });
    expect(application.errors.reports.filter((reported) => reported.report.origin === 'event')).toEqual([]);
    expect((await application.get(ReminderRepository).findByAppointment('appointment-1'))?.status).toBe('planned');
  });

  it('leaves a due reminder planned, so that the next occurrence of the job sends it', async () => {
    const { application, mailer } = await arrange();

    await application.commandBus.execute(
      new PlanReminderCommand(operator, {
        appointmentId: 'appointment-1',
        recipientId: 'patient-1',
        startsAt: new Date(startsAt),
      }),
    );

    const outage = new Error('provider unreachable');

    mailer.failNextWith(outage);

    await expect(application.commandBus.execute(new SendDueRemindersCommand(operator, NOW))).rejects.toBe(outage);

    const afterTheOutage = (await application.get(ReminderRepository).findByAppointment('appointment-1'))?.status;

    await application.commandBus.execute(new SendDueRemindersCommand(operator, new Date('2026-01-09T09:15:00.000Z')));

    expect(afterTheOutage).toBe('planned');

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'reminder', appointmentId: 'appointment-1' },
    ]);

    expect((await application.get(ReminderRepository).findByAppointment('appointment-1'))?.status).toBe('sent');
  });
});

/** The whole context on the in-process PostgreSQL, with its unit of work: only the mailer is a fake, failing on demand. */
async function arrange() {
  const mailer = new FakeMailer();

  const application = createTestApplication({
    modules: [storage(), contextModule('notification', notificationDeclarations), authorization],
    fakes: [
      fake(Mailer, mailer),
      fake(UnitOfWork, database.persistence.unitOfWork),
      fake(ProcessedEventStore, database.persistence.processedEvents),
    ],
    now: NOW,
    executionContext: anExecutionContext().ofTenant(NETWORK).build(),
  });

  const deadLetters = new DeadLetterReports(application.errors);

  const relay = new OutboxRelay({
    store: database.persistence.outbox,
    publisher: application.eventBus,
    clock: application.clock,
    maxAttempts: 3,
    onFailure: (failure) => {
      deadLetters.onFailure(failure);
    },
  });

  await application.start();
  await application.eventBus.publish([adaRegistered()]);

  return { application, mailer, relay };
}

/** The contact of the patient, as identity announced it in the network. */
function adaRegistered() {
  return {
    ...personRegisteredV1.create(
      { personId: 'patient-1', displayName: 'Ada Lovelace', email: 'ada@example.test' },
      { id: 'event-registered', occurredAt: new Date('2026-01-01T08:00:00.000Z') },
    ),
    tenantId: NETWORK,
  };
}

function storage() {
  return defineContextModule({
    name: 'storage',
    register(builder) {
      builder.bind(KnexContext).toValue(database.persistence.database);
    },
  });
}
