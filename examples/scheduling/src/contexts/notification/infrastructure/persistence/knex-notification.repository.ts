import { type Clock, type ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import {
  KnexContext,
  auditRow,
  insertIgnoringConflict,
  optimisticUpdate,
  ownTenantTable,
  tenantRow,
  tenantTable,
} from '@ddd-ts-kit/knex';
import type { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate';
import { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { NotificationMapper } from '@/contexts/notification/infrastructure/persistence/notification.mapper';
import type {
  NotificationColumns,
  NotificationRow,
} from '@/contexts/notification/infrastructure/persistence/notification-row.schema';

type VersionedNotification = NotificationColumns & { readonly version: number };

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: NOTIFICATION_SCHEMA, table: 'notifications' };

@Repository(NotificationRepository)
export class KnexNotificationRepository implements NotificationRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Notification | undefined> {
    const row = await tenantTable<NotificationRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : NotificationMapper.toDomain(row);
  }

  async findByCause(cause: string, recipientId: string): Promise<Notification | undefined> {
    const row = await tenantTable<NotificationRow>(this.database, this.scope, TABLE)
      .where({ cause, recipient_id: recipientId })
      .first();

    return row === undefined ? undefined : NotificationMapper.toDomain(row);
  }

  async save(saved: Notification): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...NotificationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedNotification): Promise<number> {
    const row = {
      ...state,
      ...tenantRow(tenantScopeOf(this.scope)),
      ...auditRow(stampCreation(this.scope, this.clock)),
    };

    return (await insertIgnoringConflict(
      this.database.executor(),
      ownTenantTable<NotificationRow>(this.database, this.scope, TABLE),
      { row, conflict: 'id' },
    ))
      ? 1
      : 0;
  }

  private async update(state: VersionedNotification, expected: number): Promise<number> {
    return ownTenantTable<NotificationRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
