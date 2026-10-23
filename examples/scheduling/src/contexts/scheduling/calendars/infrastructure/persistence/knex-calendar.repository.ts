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
import type { Calendar } from '@/contexts/scheduling/calendars/domain/aggregates/calendar.aggregate';
import { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import { CalendarMapper } from '@/contexts/scheduling/calendars/infrastructure/persistence/calendar.mapper';
import type {
  CalendarColumns,
  CalendarRow,
} from '@/contexts/scheduling/calendars/infrastructure/persistence/calendar-row.schema';

type VersionedCalendar = CalendarColumns & { readonly version: number };

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: SCHEDULING_SCHEMA, table: 'calendars' };

@Repository(CalendarRepository)
export class KnexCalendarRepository implements CalendarRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Calendar | undefined> {
    const row = await tenantTable<CalendarRow>(this.database, this.scope, TABLE).where({ id }).first();

    return row === undefined ? undefined : CalendarMapper.toDomain(row);
  }

  async save(saved: Calendar): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...CalendarMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedCalendar): Promise<number> {
    const row = {
      ...state,
      ...tenantRow(tenantScopeOf(this.scope)),
      ...auditRow(stampCreation(this.scope, this.clock)),
    };

    return (await insertIgnoringConflict(
      this.database.executor(),
      ownTenantTable<CalendarRow>(this.database, this.scope, TABLE),
      { row, conflict: 'id' },
    ))
      ? 1
      : 0;
  }

  private async update(state: VersionedCalendar, expected: number): Promise<number> {
    return ownTenantTable<CalendarRow>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
