import { AuthorizedQuery, type Actor, type PageRequest } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '../../authorization/notification.permissions.js';
import type { SearchNotificationsResult, SearchNotificationsSort } from './search-notifications.result.js';

@Requires(notificationPermissions['notification.read'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class SearchNotificationsQuery extends AuthorizedQuery<SearchNotificationsResult> {
  constructor(
    actor: Actor,
    readonly page: PageRequest<SearchNotificationsSort>,
  ) {
    super(actor);
  }
}
