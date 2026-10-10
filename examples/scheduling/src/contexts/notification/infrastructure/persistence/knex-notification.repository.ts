import type { Knex } from 'knex';
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Notification } from '../../domain/aggregates/notification.aggregate.js';
import { NotificationRepository } from '../../domain/repositories/notification.repository.js';
import { NOTIFICATION_SCHEMA } from './notification.schema.js';
import { NotificationMapper } from './notification.mapper.js';
import type { NotificationColumns, NotificationRow } from './notification-row.schema.js';

type VersionedNotification = NotificationColumns & { readonly version: number };

@Repository(NotificationRepository, [KnexContext, ExecutionScope, Clock])
export class KnexNotificationRepository implements NotificationRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Notification | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : NotificationMapper.toDomain(row);
  }

  async findByCause(cause: string, recipientId: string): Promise<Notification | undefined> {
    const row = await tableOf(this.database).where({ cause, recipient_id: recipientId }).first();

    return row === undefined ? undefined : NotificationMapper.toDomain(row);
  }

  async save(saved: Notification): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...NotificationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedNotification): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' })) ? 1 : 0;
  }

  private async update(state: VersionedNotification, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<NotificationRow, NotificationRow[]> {
  return database.executor()<NotificationRow, NotificationRow[]>('notifications').withSchema(NOTIFICATION_SCHEMA);
}
