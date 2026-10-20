import { injected } from '@ddd-ts-kit/kernel/declarations';
import { SearchNotificationsReader } from '@/contexts/notification/application/ports/search-notifications-reader.port';
import { SearchNotificationsHandler } from '@/contexts/notification/application/queries/search-notifications/search-notifications.handler';
import { Access } from '@ddd-ts-kit/auth';

export * from '@/contexts/notification/application/queries/search-notifications/search-notifications.handler';
export * from '@/contexts/notification/application/queries/search-notifications/search-notifications.query';

injected(SearchNotificationsHandler, [SearchNotificationsReader, Access]);
