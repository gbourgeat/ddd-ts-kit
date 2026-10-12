import type { Knex } from 'knex';
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import { CalendarMapper } from '@/contexts/scheduling/infrastructure/persistence/calendar.mapper';
import type {
  CalendarColumns,
  CalendarRow,
} from '@/contexts/scheduling/infrastructure/persistence/calendar-row.schema';

type VersionedCalendar = CalendarColumns & { readonly version: number };

@Repository(CalendarRepository, [KnexContext, ExecutionScope, Clock])
export class KnexCalendarRepository implements CalendarRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Calendar | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : CalendarMapper.toDomain(row);
  }

  async save(saved: Calendar): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...CalendarMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedCalendar): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedCalendar, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<CalendarRow, CalendarRow[]> {
  return database.executor()<CalendarRow, CalendarRow[]>('calendars').withSchema(SCHEDULING_SCHEMA);
}
