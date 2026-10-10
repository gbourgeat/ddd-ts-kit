import { Access } from '@ddd-ts-kit/auth';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '#src/contexts/notification/application/authorization/notification.permissions.js';
import { SearchNotificationsReader } from '#src/contexts/notification/application/ports/search-notifications-reader.port.js';
import { SearchNotificationsQuery } from '#src/contexts/notification/application/queries/search-notifications/search-notifications.query.js';
import type { SearchNotificationsResult } from '#src/contexts/notification/application/queries/search-notifications/search-notifications.result.js';

@QueryHandler(SearchNotificationsQuery, [SearchNotificationsReader, Access])
export class SearchNotificationsHandler implements QueryHandler<SearchNotificationsQuery> {
  constructor(
    private readonly reader: SearchNotificationsReader,
    private readonly access: Access,
  ) {}

  async execute(query: SearchNotificationsQuery): Promise<SearchNotificationsResult> {
    // A person reads the notifications sent to themselves: the scope names the persons the actor is, and the read port narrows the recipients to them.
    const scope = await this.access.scope(query.actor, notificationPermissions['notification.read'], 'person');

    return this.reader.search(scope, query.page);
  }
}
