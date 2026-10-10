import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '../../notification.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { SendDueRemindersCommand } from '../../application/commands/send-due-reminders/send-due-reminders.command.js';
import { Contacts } from '../../application/ports/contacts.port.js';
import { Mailer } from '../../application/ports/mailer.port.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { ReminderRepository } from '../../domain/repositories/reminder.repository.js';
import { aReminder } from '../builders/reminder.builder.js';
import { FakeContacts } from '../fakes/contacts.fake.js';
import { FakeMailer } from '../fakes/mailer.fake.js';
import { FakeNotificationRepository } from '../fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '../fakes/reminder.repository.fake.js';

const permissions = Object.values(notificationPermissions);
const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [notificationPermissions['reminder.send']], system: permissions }, systemRole: 'system' }) });
const holder = anActor().withRole('holder').build();
const NOW = new Date('2026-01-09T09:00:00.000Z');
const inOneDay = new Date('2026-01-10T09:00:00.000Z');
const inTwoDays = new Date('2026-01-11T09:00:00.000Z');

describe('Send due reminders', () => {
  it('sends the reminders whose appointment starts within 24 hours, and leaves the others planned', async () => {
    const { application, reminderRepository, mailer } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-due').of('appointment-1').plannedFor(inOneDay).build());
    await reminderRepository.save(aReminder().identifiedBy('reminder-later').of('appointment-2').plannedFor(inTwoDays).build());
    await application.commandBus.execute(new SendDueRemindersCommand(holder, NOW));

    expect((await reminderRepository.findById('reminder-due'))?.status).toBe('sent');
    expect((await reminderRepository.findById('reminder-later'))?.status).toBe('planned');
    expect(mailer.delivered).toEqual([{ address: 'ada@example.test', recipientId: 'patient-1', kind: 'reminder', appointmentId: 'appointment-1' }]);
  });

  it('is refused to an actor who does not hold the permission reminder.send', async () => {
    const { application } = await arrange();

    await expect(application.commandBus.execute(new SendDueRemindersCommand(anActor().build(), NOW))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps the reminder as a notification sent to its recipient', async () => {
    const { application, reminderRepository, notificationRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-due').of('appointment-1').plannedFor(inOneDay).build());
    await application.commandBus.execute(new SendDueRemindersCommand(holder, NOW));

    expect(notificationRepository.all().map((sent) => sent.toState())).toMatchObject([{ recipientId: 'patient-1', appointmentId: 'appointment-1', startsAt: inOneDay, cause: 'reminder:reminder-due@2026-01-10T09:00:00.000Z' }]);
  });

  it('sends a reminder once per appointment and start, however many times the same instant is asked', async () => {
    const { application, reminderRepository, mailer } = await arrange();

    await reminderRepository.save(aReminder().of('appointment-1').plannedFor(inOneDay).build());
    await application.commandBus.execute(new SendDueRemindersCommand(holder, NOW));
    await application.commandBus.execute(new SendDueRemindersCommand(holder, NOW));

    expect(mailer.delivered).toHaveLength(1);
  });

  it('judges what is due at the instant it is asked for, not at the instant it runs', async () => {
    const { application, reminderRepository, mailer } = await arrange();

    await reminderRepository.save(aReminder().of('appointment-1').plannedFor(inOneDay).build());
    application.clock.advance(60 * 60 * 1000);
    await application.commandBus.execute(new SendDueRemindersCommand(holder, new Date('2026-01-09T08:45:00.000Z')));

    expect(mailer.delivered).toEqual([]);
  });

  it('sends neither a withdrawn reminder nor the reminder of an appointment that already started', async () => {
    const { application, reminderRepository, mailer } = await arrange();

    await reminderRepository.save(aReminder().of('appointment-1').plannedFor(inOneDay).withdrawn().build());
    await reminderRepository.save(aReminder().of('appointment-2').plannedFor(new Date('2026-01-09T08:00:00.000Z')).build());
    await application.commandBus.execute(new SendDueRemindersCommand(holder, NOW));

    expect(mailer.attempts).toBe(0);
  });

  it('fails when the mailer does not take a reminder, and keeps no notification of it', async () => {
    const { application, reminderRepository, notificationRepository, mailer } = await arrange();

    await reminderRepository.save(aReminder().of('appointment-1').plannedFor(inOneDay).build());
    mailer.failNextWith(new Error('provider unreachable'));

    // The reminder goes back to planned with the unit of work of the command, which a fake does not have: the next occurrence then sends it.
    await expect(application.commandBus.execute(new SendDueRemindersCommand(holder, NOW))).rejects.toThrow('provider unreachable');

    expect(mailer.delivered).toEqual([]);
    expect(notificationRepository.count()).toBe(0);
  });
});

async function arrange() {
  const reminderRepository = new FakeReminderRepository();
  const notificationRepository = new FakeNotificationRepository();
  const contacts = new FakeContacts();
  const mailer = new FakeMailer();

  await contacts.know('patient-1', 'ada@example.test');

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('notification', notificationDeclarations), holders],
    fakes: [fake(ReminderRepository, reminderRepository), fake(NotificationRepository, notificationRepository), fake(Contacts, contacts), fake(Mailer, mailer)],
    now: NOW,
  });

  return { application, reminderRepository, notificationRepository, mailer };
}
