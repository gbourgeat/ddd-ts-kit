import { injected } from '@ddd-ts-kit/kernel/declarations';
import { SearchNotificationsController } from '@/contexts/notification/presentation/http/notifications/search-notifications/search-notifications.controller';
import { QueryBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/notification/presentation/http/notifications/search-notifications/search-notifications.controller';

injected(SearchNotificationsController, [QueryBus]);
