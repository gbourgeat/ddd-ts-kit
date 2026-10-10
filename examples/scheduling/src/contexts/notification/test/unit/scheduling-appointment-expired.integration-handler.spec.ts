import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import * as notificationDeclarations from '../../notification.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { appointmentExpiredV1 } from '../../../scheduling/published-language/index.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { SchedulingAppointmentExpiredIntegrationHandler } from '../../application/integration/handlers/scheduling-appointment-expired.integration-handler.js';
import { Contacts } from '../../application/ports/contacts.port.js';
import { Mailer } from '../../application/ports/mailer.port.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { ReminderRepository } from '../../domain/repositories/reminder.repository.js';
import { aReminder } from '../builders/reminder.builder.js';
import { FakeContacts } from '../fakes/contacts.fake.js';
import { FakeMailer } from '../fakes/mailer.fake.js';
import { FakeNotificationRepository } from '../fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '../fakes/reminder.repository.fake.js';

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { system: Object.values(notificationPermissions) }, systemRole: 'system' }) });
const startsAt = '2026-01-10T09:00:00.000Z';
const appointment = { appointmentId: 'appointment-1', calendarId: 'calendar-1', practiceId: 'practice-1', practitionerId: 'practitioner-1', patientId: 'patient-1', startsAt, endsAt: '2026-01-10T09:30:00.000Z', day: '2026-01-10' };

describe('When scheduling publishes scheduling.appointment.expired', () => {
  it('listens to the type scheduling publishes', () => {
    const handler = new SchedulingAppointmentExpiredIntegrationHandler(new InMemoryCommandBus());

    expect(handler).toBeInstanceOf(SchedulingAppointmentExpiredIntegrationHandler);
    expect(SchedulingAppointmentExpiredIntegrationHandler.eventType).toBe('scheduling.appointment.expired');
  });

  it('acts as a system actor named after its consumer name', () => {
    const handler = new SchedulingAppointmentExpiredIntegrationHandler(new InMemoryCommandBus());

    expect(handler.actor).toMatchObject({ id: 'system:notification.scheduling-appointment-expired', type: 'system' });
  });

  it('withdraws the reminder of the appointment nobody confirmed, and sends nothing', async () => {
    const { application, reminderRepository, mailer } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(new Date(startsAt)).build());
    await application.eventBus.publish([expired('event-1')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
    expect(mailer.attempts).toBe(0);
  });

  it('has the same outcome when the same event is delivered twice, or for an appointment without a reminder', async () => {
    const { application, reminderRepository, notificationRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(new Date(startsAt)).build());
    await application.eventBus.publish([expired('event-1')]);
    await application.eventBus.publish([expired('event-1')]);
    await application.eventBus.publish([appointmentExpiredV1.create({ ...appointment, appointmentId: 'appointment-unknown' }, { id: 'event-2', occurredAt: new Date('2026-01-02T08:00:00.000Z') })]);

    expect(reminderRepository.count()).toBe(1);
    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
    expect(notificationRepository.count()).toBe(0);
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
    fakes: [fake(NotificationRepository, notificationRepository), fake(ReminderRepository, reminderRepository), fake(Contacts, contacts), fake(Mailer, mailer)],
  });

  await application.start();

  return { application, notificationRepository, reminderRepository, mailer };
}

function expired(id: string) {
  return appointmentExpiredV1.create(appointment, { id, occurredAt: new Date('2026-01-02T08:00:00.000Z') });
}
