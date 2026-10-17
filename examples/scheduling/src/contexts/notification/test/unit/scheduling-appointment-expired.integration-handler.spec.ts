import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { appointmentExpiredV1 } from '@/contexts/scheduling/published-language/index';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { SchedulingAppointmentExpiredIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-expired.integration-handler';
import { aReminder } from '@/contexts/notification/test/builders/reminder.builder';
import { aNotificationWorld } from '@/contexts/notification/test/worlds/notification.world';

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

    await reminderRepository.save(
      aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(new Date(startsAt)).build(),
    );

    await application.eventBus.publish([expired('event-1')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
    expect(mailer.attempts).toBe(0);
  });

  it('has the same outcome when the same event is delivered twice, or for an appointment without a reminder', async () => {
    const { application, reminderRepository, notificationRepository } = await arrange();

    await reminderRepository.save(
      aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(new Date(startsAt)).build(),
    );

    await application.eventBus.publish([expired('event-1')]);
    await application.eventBus.publish([expired('event-1')]);

    await application.eventBus.publish([
      appointmentExpiredV1.create(
        { ...appointment, appointmentId: 'appointment-unknown' },
        { id: 'event-2', occurredAt: new Date('2026-01-02T08:00:00.000Z') },
      ),
    ]);

    expect(reminderRepository.count()).toBe(1);
    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
    expect(notificationRepository.count()).toBe(0);
  });
});

async function arrange() {
  const arranged = await aNotificationWorld({
    modules: [authorization],
    given: async ({ contacts }) => {
      await contacts.know('patient-1', 'ada@example.test');
    },
  });

  await arranged.application.start();

  return arranged;
}

function expired(id: string) {
  return appointmentExpiredV1.create(appointment, { id, occurredAt: new Date('2026-01-02T08:00:00.000Z') });
}
