import type { Knex } from 'knex';
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Reminder } from '@/contexts/notification/domain/aggregates/reminder.aggregate';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { NOTIFICATION_SCHEMA } from '@/contexts/notification/infrastructure/persistence/notification.schema';
import { ReminderMapper } from '@/contexts/notification/infrastructure/persistence/reminder.mapper';
import type {
  ReminderColumns,
  ReminderRow,
} from '@/contexts/notification/infrastructure/persistence/reminder-row.schema';

type VersionedReminder = ReminderColumns & { readonly version: number };

@Repository(ReminderRepository)
export class KnexReminderRepository implements ReminderRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Reminder | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : ReminderMapper.toDomain(row);
  }

  async findByAppointment(appointmentId: string): Promise<Reminder | undefined> {
    const row = await tableOf(this.database).where({ appointment_id: appointmentId }).first();

    return row === undefined ? undefined : ReminderMapper.toDomain(row);
  }

  async findDue(asOf: Date): Promise<readonly Reminder[]> {
    const rows = await tableOf(this.database)
      .where({ status: 'planned' })
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
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedReminder, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<ReminderRow, ReminderRow[]> {
  return database.executor()<ReminderRow, ReminderRow[]>('reminders').withSchema(NOTIFICATION_SCHEMA);
}
