import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '../../notification.declarations.js';
import type { Message } from '@ddd-ts-kit/kernel';
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

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { scheduler: Object.values(notificationPermissions) },
    systemRole: 'scheduler',
  }),
});

const NOW = new Date('2026-01-09T09:00:00.000Z');

describe('Send due reminders, when its time comes', () => {
  it('sends send due reminders as the system actor of the job', async () => {
    const { application, sent } = await arrangeObserved();

    await application.jobs.runNow('notification.send-due-reminders');

    expect(sent[0]).toBeInstanceOf(SendDueRemindersCommand);
    expect(sent[0]).toMatchObject({ actor: { id: 'system:notification.send-due-reminders', type: 'system' } });
  });

  it('asks for the reminders due at the instant of its occurrence', async () => {
    const { application, sent } = await arrangeObserved();

    await application.jobs.runNow('notification.send-due-reminders');

    expect(sent[0]).toMatchObject({ asOf: NOW });
  });

  it('sends each due reminder once, even when the same occurrence runs twice', async () => {
    const { application, reminderRepository, mailer } = await arrangeObserved();

    await reminderRepository.save(
      aReminder().of('appointment-1').plannedFor(new Date('2026-01-10T09:00:00.000Z')).build(),
    );

    await application.jobs.runNow('notification.send-due-reminders');
    await application.jobs.runNow('notification.send-due-reminders');

    expect(mailer.delivered).toEqual([
      { address: 'ada@example.test', recipientId: 'patient-1', kind: 'reminder', appointmentId: 'appointment-1' },
    ]);
  });
});

async function arrangeObserved() {
  const arranged = await arrange();
  const sent: Message[] = [];

  arranged.application.commandBus.use(async (message, next) => {
    sent.push(message);

    return next();
  });

  return { ...arranged, sent };
}

async function arrange() {
  const reminderRepository = new FakeReminderRepository();
  const notificationRepository = new FakeNotificationRepository();
  const contacts = new FakeContacts();
  const mailer = new FakeMailer();

  await contacts.know('patient-1', 'ada@example.test');

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('notification', notificationDeclarations), holders],
    fakes: [
      fake(ReminderRepository, reminderRepository),
      fake(NotificationRepository, notificationRepository),
      fake(Contacts, contacts),
      fake(Mailer, mailer),
    ],
    now: NOW,
  });

  return { application, reminderRepository, notificationRepository, mailer };
}
