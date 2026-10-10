import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '../../notification.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { SendNotificationCommand } from '../../application/commands/send-notification/send-notification.command.js';
import { Contacts } from '../../application/ports/contacts.port.js';
import { Mailer } from '../../application/ports/mailer.port.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { ReminderRepository } from '../../domain/repositories/reminder.repository.js';
import { FakeContacts } from '../fakes/contacts.fake.js';
import { FakeMailer } from '../fakes/mailer.fake.js';
import { FakeNotificationRepository } from '../fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '../fakes/reminder.repository.fake.js';

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
  const notificationRepository = new FakeNotificationRepository();
  const contacts = new FakeContacts();
  const mailer = new FakeMailer();

  await contacts.know('patient-1', 'ada@example.test');

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('notification', notificationDeclarations), holders],
    fakes: [
      fake(NotificationRepository, notificationRepository),
      fake(ReminderRepository, new FakeReminderRepository()),
      fake(Contacts, contacts),
      fake(Mailer, mailer),
    ],
    idPrefix: 'notification',
  });

  return { application, notificationRepository, contacts, mailer };
}
