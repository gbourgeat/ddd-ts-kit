import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { appointmentCancelledV1 } from '@/contexts/scheduling/published-language';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';
import { SchedulingAppointmentCancelledIntegrationHandler } from '@/contexts/notification/application/integration/handlers/scheduling-appointment-cancelled.integration-handler';
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

describe('When scheduling publishes scheduling.appointment.cancelled', () => {
  it('listens to the type scheduling publishes', () => {
    const handler = new SchedulingAppointmentCancelledIntegrationHandler(new InMemoryCommandBus());

    expect(handler).toBeInstanceOf(SchedulingAppointmentCancelledIntegrationHandler);
    expect(SchedulingAppointmentCancelledIntegrationHandler.eventType).toBe('scheduling.appointment.cancelled');
  });

  it('acts as a system actor named after its consumer name', () => {
    const handler = new SchedulingAppointmentCancelledIntegrationHandler(new InMemoryCommandBus());

    expect(handler.actor).toMatchObject({ id: 'system:notification.scheduling-appointment-cancelled', type: 'system' });
  });

  it('sends a cancellation to the patient of the appointment', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([cancelled('event-1')]);

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'cancellation', appointmentId: 'appointment-1' },
    ]);

    expect(notificationRepository.all().map((sent) => sent.toState())).toMatchObject([
      { recipientId: 'patient-1', startsAt: new Date(startsAt), cause: 'event-1' },
    ]);
  });

  it('sends one notification when the same event is delivered twice', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.eventBus.publish([cancelled('event-1')]);
    await application.eventBus.publish([cancelled('event-1')]);

    expect(mailer.delivered).toHaveLength(1);
    expect(notificationRepository.count()).toBe(1);
  });

  it('withdraws the reminder of the appointment', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(
      aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(new Date(startsAt)).build(),
    );

    await application.eventBus.publish([cancelled('event-1')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
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

function cancelled(id: string) {
  return appointmentCancelledV1.create(
    { ...appointment, cancelledBy: 'practice' as const },
    { id, occurredAt: new Date('2026-01-02T08:00:00.000Z') },
  );
}
