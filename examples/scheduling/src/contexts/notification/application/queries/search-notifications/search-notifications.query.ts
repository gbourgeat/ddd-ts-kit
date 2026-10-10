import { AuthorizedQuery, type Actor, type PageRequest } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions.js';
import type {
  SearchNotificationsResult,
  SearchNotificationsSort,
} from '@/contexts/notification/application/queries/search-notifications/search-notifications.result.js';

@Requires(notificationPermissions['notification.read'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class SearchNotificationsQuery extends AuthorizedQuery<SearchNotificationsResult> {
  constructor(
    actor: Actor,
    readonly page: PageRequest<SearchNotificationsSort>,
  ) {
    super(actor);
  }
}
