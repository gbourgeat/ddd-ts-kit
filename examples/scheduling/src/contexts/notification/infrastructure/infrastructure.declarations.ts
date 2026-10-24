import { injected } from '@ddd-ts-kit/kernel/declarations';
import { RemoteMailer } from '@/contexts/notification/infrastructure/external/remote-mailer.adapter';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { KnexNotificationPersonalDataErasure } from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-erasure.repository';
import { KnexNotificationPersonalDataExport } from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-export.repository';
import { KnexNotificationRepository } from '@/contexts/notification/infrastructure/persistence/knex-notification.repository';
import { KnexReminderRepository } from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
import { KnexSearchNotificationsReader } from '@/contexts/notification/infrastructure/persistence/knex-search-notifications-reader.repository';
import { Clock, ExecutionScope, Logger } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/notification/infrastructure/external/remote-mailer.adapter';
export * from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-erasure.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-notification-personal-data-export.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-notification.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-search-notifications-reader.repository';

injected(RemoteMailer, [Logger]);
injected(KnexContacts, [KnexContext, ExecutionScope]);
injected(KnexNotificationPersonalDataErasure, [KnexContext, ExecutionScope, Clock]);
injected(KnexNotificationPersonalDataExport, [KnexContext, ExecutionScope]);
injected(KnexNotificationRepository, [KnexContext, ExecutionScope, Clock]);
injected(KnexReminderRepository, [KnexContext, ExecutionScope, Clock]);
injected(KnexSearchNotificationsReader, [KnexContext, ExecutionScope]);
