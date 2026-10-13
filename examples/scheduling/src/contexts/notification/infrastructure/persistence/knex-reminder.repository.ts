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
import type { Reminder } from '@/contexts/notification/domain/aggregates/reminder.aggregate';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { ReminderMapper } from '@/contexts/notification/infrastructure/persistence/reminder.mapper';
import type {
  ReminderColumns,
  ReminderRow,
} from '@/contexts/notification/infrastructure/persistence/reminder-row.schema';
import { ReminderStatus } from '@/contexts/notification/domain/vocabularies/reminder-status.vocabulary';

type VersionedReminder = ReminderColumns & { readonly version: number };

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: NOTIFICATION_SCHEMA, table: 'reminders' };

@Repository(ReminderRepository)
export class KnexReminderRepository implements ReminderRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Reminder | undefined> {
    const row = await tenantTable<ReminderRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : ReminderMapper.toDomain(row);
  }

  async findByAppointment(appointmentId: string): Promise<Reminder | undefined> {
    const row = await tenantTable<ReminderRow>(this.database, this.scope, TABLE)
      .where({ appointment_id: appointmentId })
      .first();

    return row === undefined ? undefined : ReminderMapper.toDomain(row);
  }

  async findDue(asOf: Date): Promise<readonly Reminder[]> {
    const rows = await tenantTable<ReminderRow>(this.database, this.scope, TABLE)
      .where({ status: ReminderStatus.Planned })
      .where('due_at', '<=', asOf)
      .where('starts_at', '>', asOf)
      .orderBy('due_at')
      .orderBy('id');

    return rows.map((row) => ReminderMapper.toDomain(row));
  }

  async save(saved: Reminder): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...ReminderMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedReminder): Promise<number> {
    const row = {
      ...state,
      ...tenantRow(tenantScopeOf(this.scope)),
      ...auditRow(stampCreation(this.scope, this.clock)),
    };

    return (await insertIgnoringConflict(
      this.database.executor(),
      ownTenantTable<ReminderRow>(this.database, this.scope, TABLE),
      { row, conflict: 'id' },
    ))
      ? 1
      : 0;
  }

  private async update(state: VersionedReminder, expected: number): Promise<number> {
    return ownTenantTable<ReminderRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
