import { AuthorizedQuery, type Actor, type PageRequest } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '../../authorization/notification.permissions.js';
import type { ListNotificationsResult, ListNotificationsSort } from './list-notifications.result.js';

@Requires(notificationPermissions['notification.read'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class ListNotificationsQuery extends AuthorizedQuery<ListNotificationsResult> {
  constructor(
    actor: Actor,
    readonly page: PageRequest<ListNotificationsSort>,
  ) {
    super(actor);
  }
}
