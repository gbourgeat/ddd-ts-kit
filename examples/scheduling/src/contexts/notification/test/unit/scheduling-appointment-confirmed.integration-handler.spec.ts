import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations.js';
import { platformTestModule } from '@/platform/platform-test.module.js';
import { appointmentConfirmedV1 } from '@/contexts/scheduling/published-language/index.js';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions.js';
import { SchedulingAppointmentConfirmedIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-confirmed.integration-handler.js';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port.js';
import { Mailer } from '@/contexts/notification/application/ports/mailer.port.js';
import { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository.js';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository.js';
import { FakeContacts } from '@/contexts/notification/test/fakes/contacts.fake.js';
import { FakeMailer } from '@/contexts/notification/test/fakes/mailer.fake.js';
import { FakeNotificationRepository } from '@/contexts/notification/test/fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '@/contexts/notification/test/fakes/reminder.repository.fake.js';

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

describe('When scheduling publishes scheduling.appointment.confirmed', () => {
  it('listens to the type scheduling publishes', () => {
    const handler = new SchedulingAppointmentConfirmedIntegrationHandler(new InMemoryCommandBus());

    expect(handler).toBeInstanceOf(SchedulingAppointmentConfirmedIntegrationHandler);
    expect(SchedulingAppointmentConfirmedIntegrationHandler.eventType).toBe('scheduling.appointment.confirmed');
  });

  it('acts as a system actor named after its consumer name', () => {
    const handler = new SchedulingAppointmentConfirmedIntegrationHandler(new InMemoryCommandBus());

    expect(handler.actor).toMatchObject({ id: 'system:notification.scheduling-appointment-confirmed', type: 'system' });
  });

  it('sends a confirmation to the patient of the appointment', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([confirmed('event-1')]);

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'confirmation', appointmentId: 'appointment-1' },
    ]);

    expect(notificationRepository.all().map((sent) => sent.toState())).toMatchObject([
      { recipientId: 'patient-1', startsAt: new Date(startsAt), cause: 'event-1' },
    ]);
  });

  it('sends one notification when the same event is delivered twice', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([confirmed('event-1')]);
    await application.eventBus.publish([confirmed('event-1')]);

    expect(mailer.delivered).toHaveLength(1);
    expect(notificationRepository.count()).toBe(1);
  });

  it('keeps the reminder of the appointment planned for its start', async () => {
    const { application, reminderRepository } = await arrange();

    await application.eventBus.publish([confirmed('event-1')]);

    expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([
      { appointmentId: 'appointment-1', startsAt: new Date(startsAt), status: 'planned' },
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

function confirmed(id: string) {
  return appointmentConfirmedV1.create(appointment, { id, occurredAt: new Date('2026-01-02T08:00:00.000Z') });
}
