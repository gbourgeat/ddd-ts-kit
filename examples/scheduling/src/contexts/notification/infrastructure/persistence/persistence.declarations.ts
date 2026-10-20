import { injected } from '@ddd-ts-kit/kernel/declarations';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { KnexNotificationRepository } from '@/contexts/notification/infrastructure/persistence/knex-notification.repository';
import { KnexReminderRepository } from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
import { KnexSearchNotificationsReader } from '@/contexts/notification/infrastructure/persistence/knex-search-notifications-reader.repository';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-notification.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
export * from '@/contexts/notification/infrastructure/persistence/knex-search-notifications-reader.repository';

injected(KnexContacts, [KnexContext, ExecutionScope]);
injected(KnexNotificationRepository, [KnexContext, ExecutionScope, Clock]);
injected(KnexReminderRepository, [KnexContext, ExecutionScope, Clock]);
injected(KnexSearchNotificationsReader, [KnexContext, ExecutionScope]);
