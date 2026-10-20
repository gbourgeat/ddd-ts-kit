import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake, type ContextModule } from '@ddd-ts-kit/di';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port';
import { Mailer } from '@/contexts/notification/application/ports/mailer.port';
import { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { FakeContacts } from '@/contexts/notification/test/fakes/contacts.fake';
import { FakeMailer } from '@/contexts/notification/test/fakes/mailer.fake';
import { FakeNotificationRepository } from '@/contexts/notification/test/fakes/notification.repository.fake';
import { FakeReminderRepository } from '@/contexts/notification/test/fakes/reminder.repository.fake';

const nobody = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });

export interface NotificationWorldFakes {
  readonly contacts: FakeContacts;
  readonly mailer: FakeMailer;
  readonly notificationRepository: FakeNotificationRepository;
  readonly reminderRepository: FakeReminderRepository;
}

export interface NotificationWorldOptions {
  readonly now?: Date;
  readonly idPrefix?: string;
  readonly modules?: readonly ContextModule[];
  readonly given?: (fakes: NotificationWorldFakes) => Promise<void>;
}

export async function aNotificationWorld({ modules = [nobody], given, ...settings }: NotificationWorldOptions = {}) {
  const context = contextModule('notification', notificationDeclarations);

  const fakes = {
    contacts: new FakeContacts(),
    mailer: new FakeMailer(),
    notificationRepository: new FakeNotificationRepository(),
    reminderRepository: new FakeReminderRepository(),
  };

  await given?.(fakes);

  const application = createTestApplication({
    ...settings,
    eventBusFailures: 'as-thrown',
    modules: [platformTestModule, context, ...modules],
    fakes: [
      fake(Contacts, fakes.contacts),
      fake(Mailer, fakes.mailer),
      fake(NotificationRepository, fakes.notificationRepository),
      fake(ReminderRepository, fakes.reminderRepository),
    ],
  });

  return { application, ...fakes };
}
