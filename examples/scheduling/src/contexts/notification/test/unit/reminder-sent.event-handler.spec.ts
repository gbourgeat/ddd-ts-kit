import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '../../notification.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { notificationPermissions } from '../../application/authorization/notification.permissions.js';
import { Contacts } from '../../application/ports/contacts.port.js';
import { Mailer } from '../../application/ports/mailer.port.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { ReminderRepository } from '../../domain/repositories/reminder.repository.js';
import { aReminder } from '../builders/reminder.builder.js';
import { FakeContacts } from '../fakes/contacts.fake.js';
import { FakeMailer } from '../fakes/mailer.fake.js';
import { FakeNotificationRepository } from '../fakes/notification.repository.fake.js';
import { FakeReminderRepository } from '../fakes/reminder.repository.fake.js';
import { ReminderSent } from '../../domain/events/reminder-sent.event.js';

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { system: Object.values(notificationPermissions) }, systemRole: 'system' }) });
const startsAt = new Date('2026-01-10T09:00:00.000Z');

describe('When reminder sent', () => {
  it('notifies the recipient of the reminder, with the start of the appointment', async () => {
    const { application, notificationRepository, mailer } = await arrange();

    await application.domainEvents.dispatch([sent()]);

    expect(mailer.delivered).toEqual([{ address: 'ada@example.test', recipientId: 'patient-1', kind: 'reminder', appointmentId: 'appointment-1' }]);
    expect(notificationRepository.all().map((kept) => kept.toState())).toMatchObject([{ recipientId: 'patient-1', appointmentId: 'appointment-1', startsAt }]);
  });

  it('notifies once per reminder and start, however many times the fact is told', async () => {
    const { application, mailer } = await arrange();

    await application.domainEvents.dispatch([sent()]);
    await application.domainEvents.dispatch([sent()]);

    expect(mailer.delivered).toHaveLength(1);
  });

  it('plans no further reminder for the reminder it sent', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).sent(new Date('2026-01-09T09:00:00.000Z')).build());
    await application.domainEvents.dispatch([sent()]);

    expect(reminderRepository.count()).toBe(1);
  });

  it('fails when the contact of the recipient is unknown, so that the reminder is not kept as sent', async () => {
    const { application, notificationRepository } = await arrange();

    await expect(application.domainEvents.dispatch([sent('stranger')])).rejects.toMatchObject({ code: 'CONTACT_UNKNOWN' });

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

  return { application, notificationRepository, reminderRepository, mailer };
}

function sent(recipientId = 'patient-1'): ReminderSent {
  return new ReminderSent('reminder-1', new Date('2026-01-09T09:00:00.000Z'), { recipientId, appointmentId: 'appointment-1', startsAt });
}
