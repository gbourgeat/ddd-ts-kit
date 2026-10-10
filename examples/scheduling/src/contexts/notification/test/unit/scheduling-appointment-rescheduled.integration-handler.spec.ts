import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import * as notificationDeclarations from '#src/contexts/notification/notification.declarations.js';
import { platformTestModule } from '#src/platform/platform-test.module.js';
import { appointmentRescheduledV1 } from '#src/contexts/scheduling/published-language/index.js';
import { notificationPermissions } from '#src/contexts/notification/application/authorization/notification.permissions.js';
import { SchedulingAppointmentRescheduledIntegrationHandler } from '#src/contexts/notification/application/integration/handlers/scheduling-appointment-rescheduled.integration-handler.js';
import { Contacts } from '#src/contexts/notification/application/ports/contacts.port.js';
import { Mailer } from '#src/contexts/notification/application/ports/mailer.port.js';
import { NotificationRepository } from '#src/contexts/notification/domain/repositories/notification.repository.js';
import { ReminderRepository } from '#src/contexts/notification/domain/repositories/reminder.repository.js';
import { aReminder } from '#src/contexts/notification/test/builders/reminder.builder.js';
import { FakeContacts } from '#src/contexts/notification/test/fakes/contacts.fake.js';
import { FakeMailer } from '#src/contexts/notification/test/fakes/mailer.fake.js';
import { FakeNotificationRepository } from '#src/contexts/notification/test/fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '#src/contexts/notification/test/fakes/reminder.repository.fake.js';

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { system: Object.values(notificationPermissions) },
    systemRole: 'system',
  }),
});

const startsAt = '2026-01-10T09:00:00.000Z';

const appointment = {
  appointmentId: 'appointment-1',
  calendarId: 'calendar-1',
  practiceId: 'practice-1',
  practitionerId: 'practitioner-1',
  patientId: 'patient-1',
  startsAt,
  endsAt: '2026-01-10T09:30:00.000Z',
  day: '2026-01-10',
};

describe('When scheduling publishes scheduling.appointment.rescheduled', () => {
  it('listens to the type scheduling publishes', () => {
    const handler = new SchedulingAppointmentRescheduledIntegrationHandler(new InMemoryCommandBus());

    expect(handler).toBeInstanceOf(SchedulingAppointmentRescheduledIntegrationHandler);
    expect(SchedulingAppointmentRescheduledIntegrationHandler.eventType).toBe('scheduling.appointment.rescheduled');
  });

  it('acts as a system actor named after its consumer name', () => {
    const handler = new SchedulingAppointmentRescheduledIntegrationHandler(new InMemoryCommandBus());

    expect(handler.actor).toMatchObject({
      id: 'system:notification.scheduling-appointment-rescheduled',
      type: 'system',
    });
  });

  it('sends a rescheduling to the patient of the appointment', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([rescheduled('event-1')]);

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'rescheduling', appointmentId: 'appointment-1' },
    ]);

    expect(notificationRepository.all().map((sent) => sent.toState())).toMatchObject([
      { recipientId: 'patient-1', startsAt: new Date(startsAt), cause: 'event-1' },
    ]);
  });

  it('sends one notification when the same event is delivered twice', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([rescheduled('event-1')]);
    await application.eventBus.publish([rescheduled('event-1')]);

    expect(mailer.delivered).toHaveLength(1);
    expect(notificationRepository.count()).toBe(1);
  });

  it('gives the moved appointment a new reminder, due 24 hours before the new start, even when the previous one was sent', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(
      aReminder()
        .identifiedBy('reminder-1')
        .of('appointment-1')
        .plannedFor(new Date('2026-01-05T09:00:00.000Z'))
        .sent(new Date('2026-01-04T09:00:00.000Z'))
        .build(),
    );

    await application.eventBus.publish([rescheduled('event-1')]);

    expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([
      {
        appointmentId: 'appointment-1',
        startsAt: new Date(startsAt),
        dueAt: new Date('2026-01-09T09:00:00.000Z'),
        status: 'planned',
      },
    ]);
  });
});

async function arrange() {
  const notificationRepository = new FakeNotificationRepository();
  const reminderRepository = new FakeReminderRepository();
  const contacts = new FakeContacts();
  const mailer = new FakeMailer();

  await contacts.know('patient-1', 'ada@example.test');

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('notification', notificationDeclarations), authorization],
    fakes: [
      fake(NotificationRepository, notificationRepository),
      fake(ReminderRepository, reminderRepository),
      fake(Contacts, contacts),
      fake(Mailer, mailer),
    ],
  });

  await application.start();

  return { application, notificationRepository, reminderRepository, mailer };
}

function rescheduled(id: string) {
  return appointmentRescheduledV1.create(
    { ...appointment, previousStartsAt: '2026-01-05T09:00:00.000Z', previousDay: '2026-01-05' },
    { id, occurredAt: new Date('2026-01-02T08:00:00.000Z') },
  );
}
