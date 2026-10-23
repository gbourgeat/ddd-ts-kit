import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { notificationPermissions } from '@/contexts/notification/notification.permissions';
import { aReminder } from '@/contexts/notification/test/builders/reminder.builder';
import { NotificationSent } from '@/contexts/notification/domain/events/notification-sent.event';
import { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo';
import { aNotificationWorld } from '@/contexts/notification/test/worlds/notification.world';

const authorization = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { system: Object.values(notificationPermissions) },
    systemRole: 'system',
  }),
});

const startsAt = new Date('2026-01-10T09:00:00.000Z');

describe('When notification sent', () => {
  it.each(['request', 'confirmation', 'rescheduling'])(
    'plans the reminder of the appointment when a %s was sent',
    async (kind) => {
      const { application, reminderRepository } = await arrange();

      await application.domainEvents.dispatch([sent(kind)]);

      expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([
        {
          appointmentId: 'appointment-1',
          recipientId: 'patient-1',
          startsAt,
          dueAt: new Date('2026-01-09T09:00:00.000Z'),
          status: 'planned',
        },
      ]);
    },
  );

  it('keeps one reminder for an appointment whose request then confirmation were sent', async () => {
    const { application, reminderRepository } = await arrange();

    await application.domainEvents.dispatch([sent('request')]);
    await application.domainEvents.dispatch([sent('confirmation')]);

    expect(reminderRepository.count()).toBe(1);
  });

  it('moves the reminder to the new start when a rescheduling was sent', async () => {
    const { application, reminderRepository } = await arrange();
    const movedTo = new Date('2026-02-01T15:00:00.000Z');

    await application.domainEvents.dispatch([sent('confirmation')]);
    await application.domainEvents.dispatch([sent('rescheduling', movedTo)]);

    expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([
      { startsAt: movedTo, dueAt: new Date('2026-01-31T15:00:00.000Z'), status: 'planned' },
    ]);
  });

  it('withdraws the reminder of the appointment when a cancellation was sent', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(
      aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).build(),
    );

    await application.domainEvents.dispatch([sent('cancellation')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
  });

  it('does nothing to the reminder when the notification sent was the reminder itself', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(
      aReminder()
        .identifiedBy('reminder-1')
        .of('appointment-1')
        .plannedFor(startsAt)
        .sent(new Date('2026-01-09T09:00:00.000Z'))
        .build(),
    );

    await application.domainEvents.dispatch([sent('reminder')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('sent');
    expect(reminderRepository.count()).toBe(1);
  });
});

async function arrange() {
  return aNotificationWorld({
    modules: [authorization],
    given: async ({ contacts }) => {
      await contacts.know('patient-1', 'ada@example.test');
    },
  });
}

function sent(kind: string, start: Date = startsAt): NotificationSent {
  return new NotificationSent('notification-1', new Date('2026-01-02T08:00:00.000Z'), {
    recipientId: 'patient-1',
    kind: NotificationKind.create(kind),
    appointmentId: 'appointment-1',
    startsAt: start,
  });
}
