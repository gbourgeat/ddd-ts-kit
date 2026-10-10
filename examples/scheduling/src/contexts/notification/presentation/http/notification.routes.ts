import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { searchNotificationsRoute } from '#src/contexts/notification/presentation/http/search-notifications.route.js';
// /ddd-ts-kit:imports

export function notificationRoutes(commands: CommandBus, queries: QueryBus): readonly Route[] {
  return [
    // ddd-ts-kit:routes
    searchNotificationsRoute(queries),
    // /ddd-ts-kit:routes
  ];
}
