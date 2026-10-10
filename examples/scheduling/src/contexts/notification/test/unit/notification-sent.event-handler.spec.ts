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
import { unwrap } from '@ddd-ts-kit/kernel';
import { NotificationSent } from '../../domain/events/notification-sent.event.js';
import { NotificationKind } from '../../domain/value-objects/notification-kind.vo.js';

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { system: Object.values(notificationPermissions) }, systemRole: 'system' }) });
const startsAt = new Date('2026-01-10T09:00:00.000Z');

describe('When notification sent', () => {
  it.each(['request', 'confirmation', 'rescheduling'])('plans the reminder of the appointment when a %s was sent', async (kind) => {
    const { application, reminderRepository } = await arrange();

    await application.domainEvents.dispatch([sent(kind)]);

    expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([
      { appointmentId: 'appointment-1', recipientId: 'patient-1', startsAt, dueAt: new Date('2026-01-09T09:00:00.000Z'), status: 'planned' },
    ]);
  });

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

    expect(reminderRepository.all().map((planned) => planned.toState())).toMatchObject([{ startsAt: movedTo, dueAt: new Date('2026-01-31T15:00:00.000Z'), status: 'planned' }]);
  });

  it('withdraws the reminder of the appointment when a cancellation was sent', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).build());
    await application.domainEvents.dispatch([sent('cancellation')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('withdrawn');
  });

  it('does nothing to the reminder when the notification sent was the reminder itself', async () => {
    const { application, reminderRepository } = await arrange();

    await reminderRepository.save(aReminder().identifiedBy('reminder-1').of('appointment-1').plannedFor(startsAt).sent(new Date('2026-01-09T09:00:00.000Z')).build());
    await application.domainEvents.dispatch([sent('reminder')]);

    expect((await reminderRepository.findById('reminder-1'))?.status).toBe('sent');
    expect(reminderRepository.count()).toBe(1);
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

function sent(kind: string, start: Date = startsAt): NotificationSent {
  return new NotificationSent('notification-1', new Date('2026-01-02T08:00:00.000Z'), { recipientId: 'patient-1', kind: unwrap(NotificationKind.create(kind)), appointmentId: 'appointment-1', startsAt: start });
}
