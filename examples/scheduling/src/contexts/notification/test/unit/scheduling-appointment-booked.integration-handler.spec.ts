import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import * as notificationDeclarations from '../../notification.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { appointmentBookedV1 } from '../../../scheduling/published-language/index.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { SchedulingAppointmentBookedIntegrationHandler } from '../../application/integration/handlers/scheduling-appointment-booked.integration-handler.js';
import { Contacts } from '../../application/ports/contacts.port.js';
import { Mailer } from '../../application/ports/mailer.port.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { ReminderRepository } from '../../domain/repositories/reminder.repository.js';
import { FakeContacts } from '../fakes/contacts.fake.js';
import { FakeMailer } from '../fakes/mailer.fake.js';
import { FakeNotificationRepository } from '../fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '../fakes/reminder.repository.fake.js';

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

describe('When scheduling publishes scheduling.appointment.booked', () => {
  it('listens to the type scheduling publishes', () => {
    const handler = new SchedulingAppointmentBookedIntegrationHandler(new InMemoryCommandBus());

    expect(handler).toBeInstanceOf(SchedulingAppointmentBookedIntegrationHandler);
    expect(SchedulingAppointmentBookedIntegrationHandler.eventType).toBe('scheduling.appointment.booked');
  });

  it('acts as a system actor named after its consumer name', () => {
    const handler = new SchedulingAppointmentBookedIntegrationHandler(new InMemoryCommandBus());

    expect(handler.actor).toMatchObject({ id: 'system:notification.scheduling-appointment-booked', type: 'system' });
  });

  it('sends a confirmation to the patient of the appointment', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([booked('event-1')]);

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'confirmation', appointmentId: 'appointment-1' },
    ]);

    expect(notificationRepository.all().map((sent) => sent.toState())).toMatchObject([
      { recipientId: 'patient-1', startsAt: new Date(startsAt), cause: 'event-1' },
    ]);
  });

  it('sends one notification when the same event is delivered twice', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([booked('event-1')]);
    await application.eventBus.publish([booked('event-1')]);

    expect(mailer.delivered).toHaveLength(1);
    expect(notificationRepository.count()).toBe(1);
  });

  it('sends a request, not a confirmation, when the appointment awaits its confirmation', async () => {
    const { application, mailer } = await arrange();

    await application.eventBus.publish([booked('event-1', 'requested')]);

    expect(mailer.delivered).toMatchObject([{ kind: 'request' }]);
  });

  it('plans the reminder of the appointment, due 24 hours before its start', async () => {
    const { application, reminderRepository } = await arrange();

    await application.eventBus.publish([booked('event-1')]);

    expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([
      {
        appointmentId: 'appointment-1',
        recipientId: 'patient-1',
        startsAt: new Date(startsAt),
        dueAt: new Date('2026-01-09T09:00:00.000Z'),
        status: 'planned',
      },
    ]);
  });

  it('lets the event fail, for its provider to deliver it again, while the contact of the patient is unknown', async () => {
    const { application, notificationRepository } = await arrange();

    await expect(
      application.eventBus.publish([
        appointmentBookedV1.create(
          { ...appointment, patientId: 'stranger', status: 'booked' },
          { id: 'event-2', occurredAt: new Date('2026-01-02T08:00:00.000Z') },
        ),
      ]),
    ).rejects.toMatchObject({ errors: [{ code: 'CONTACT_UNKNOWN' }] });

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

function booked(id: string, status: 'booked' | 'requested' = 'booked') {
  return appointmentBookedV1.create(
    { ...appointment, status },
    { id, occurredAt: new Date('2026-01-02T08:00:00.000Z') },
  );
}
