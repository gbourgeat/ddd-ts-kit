import { Access } from '@ddd-ts-kit/auth';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '../../authorization/notification.permissions.js';
import { ListNotificationsReader } from '../../ports/list-notifications-reader.port.js';
import { ListNotificationsQuery } from './list-notifications.query.js';
import type { ListNotificationsResult } from './list-notifications.result.js';

@QueryHandler(ListNotificationsQuery, [ListNotificationsReader, Access])
export class ListNotificationsHandler implements QueryHandler<ListNotificationsQuery> {
  constructor(
    private readonly reader: ListNotificationsReader,
    private readonly access: Access,
  ) {}

  async execute(query: ListNotificationsQuery): Promise<ListNotificationsResult> {
    // A person reads the notifications sent to themselves: the scope names the persons the actor is, and the read port narrows the recipients to them.
    const scope = await this.access.scope(query.actor, notificationPermissions['notification.read'], 'person');

    return this.reader.list(scope, query.page);
  }
}
