import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { notificationPermissions } from '@/contexts/notification/notification.permissions';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command';
import { aNotificationWorld } from '@/contexts/notification/test/worlds/notification.world';

const permissions = Object.values(notificationPermissions);

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [notificationPermissions['notification.send']], system: permissions },
    systemRole: 'system',
  }),
});

const holder = anActor().withRole('holder').build();
const startsAt = new Date('2026-01-10T09:00:00.000Z');

const confirmation = {
  recipientId: 'patient-1',
  kind: 'confirmation',
  appointmentId: 'appointment-1',
  startsAt,
  cause: 'event-1',
};

describe('Send notification', () => {
  it('saves the notification and answers its identifier', async () => {
    const { application, notificationRepository } = await arrange();

    const id = await application.commandBus.execute(new SendNotificationCommand(holder, confirmation));

    expect(id).toBe('notification-1');
    expect(await notificationRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission notification.send', async () => {
    const { application } = await arrange();

    await expect(
      application.commandBus.execute(new SendNotificationCommand(anActor().build(), confirmation)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('hands the notification to the mailer, for the contact of its recipient, and keeps it as sent now', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    const id = await application.commandBus.execute(new SendNotificationCommand(holder, confirmation));

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'confirmation', appointmentId: 'appointment-1' },
    ]);

    expect((await notificationRepository.findById(id))?.toState()).toMatchObject({
      recipientId: 'patient-1',
      appointmentId: 'appointment-1',
      startsAt,
      cause: 'event-1',
      registeredAt: application.clock.now(),
    });
  });

  it('announces that the notification was sent', async () => {
    const { application } = await arrange();
    const announced: string[] = [];

    application.domainEvents.on('notification.notification.sent', async (event) => {
      announced.push(event.aggregateId);
    });

    const id = await application.commandBus.execute(new SendNotificationCommand(holder, confirmation));

    expect(announced).toEqual([id]);
  });

  it('tells a cause once to a recipient: sending again answers the first notification and mails nothing', async () => {
    const { application, notificationRepository, mailer } = await arrange();
    const first = await application.commandBus.execute(new SendNotificationCommand(holder, confirmation));

    const second = await application.commandBus.execute(new SendNotificationCommand(holder, confirmation));

    expect(second).toBe(first);
    expect(mailer.delivered).toHaveLength(1);
    expect(notificationRepository.count()).toBe(1);
  });

  it('tells the same cause to another recipient', async () => {
    const { application, contacts, mailer } = await arrange();

    await contacts.know('practitioner-1', 'grace@example.test');
    await application.commandBus.execute(new SendNotificationCommand(holder, confirmation));

    await application.commandBus.execute(
      new SendNotificationCommand(holder, { ...confirmation, recipientId: 'practitioner-1' }),
    );

    expect(mailer.delivered.map((mail) => mail.address)).toEqual(['ada@example.test', 'grace@example.test']);
  });

  it('refuses to send to a recipient whose contact is unknown, with CONTACT_UNKNOWN, and saves nothing', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await expect(
      application.commandBus.execute(new SendNotificationCommand(holder, { ...confirmation, recipientId: 'stranger' })),
    ).rejects.toMatchObject({ code: 'CONTACT_UNKNOWN' });

    expect(mailer.attempts).toBe(0);
    expect(notificationRepository.count()).toBe(0);
  });

  it('refuses a kind the business does not know, with INVALID_NOTIFICATION_KIND', async () => {
    const { application, notificationRepository } = await arrange();

    await expect(
      application.commandBus.execute(new SendNotificationCommand(holder, { ...confirmation, kind: 'newsletter' })),
    ).rejects.toMatchObject({ code: 'INVALID_NOTIFICATION_KIND' });

    expect(notificationRepository.count()).toBe(0);
  });

  it('saves and announces nothing when the mailer does not take the notification', async () => {
    const { application, notificationRepository, mailer } = await arrange();
    const announced: string[] = [];

    application.domainEvents.on('notification.notification.sent', async (event) => {
      announced.push(event.aggregateId);
    });

    mailer.failNextWith(new Error('provider unreachable'));

    await expect(application.commandBus.execute(new SendNotificationCommand(holder, confirmation))).rejects.toThrow(
      'provider unreachable',
    );

    expect(notificationRepository.count()).toBe(0);
    expect(announced).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });
});

async function arrange() {
  return aNotificationWorld({
    modules: [holders],
    idPrefix: 'notification',
    given: async ({ contacts }) => {
      await contacts.know('patient-1', 'ada@example.test');
    },
  });
}
