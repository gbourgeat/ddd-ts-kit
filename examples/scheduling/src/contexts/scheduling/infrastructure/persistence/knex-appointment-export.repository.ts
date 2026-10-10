import type { Knex } from 'knex';
import { decodeCursor, encodeCursor } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext } from '@ddd-ts-kit/knex';
import {
  AppointmentExportContract,
  type ExportedAppointment,
  type ExportedAppointmentPage,
} from '@/contexts/scheduling/published-language/appointment-export.contract.js';
import type { AppointmentRow } from '@/contexts/scheduling/infrastructure/persistence/appointment-row.schema.js';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema.js';

/** The appointments of one page of the export. */
const PAGE_SIZE = 100;

/**
 * Answers the export from the table of the appointments, the source of truth, and not from the
 * agenda, which is itself a read model: what a downstream rebuilds from must not depend on
 * another projection being up to date. It takes the place of the empty answer the platform
 * binds to the contract until its owner implements it.
 */
@Repository(AppointmentExportContract, { replaces: true }, [KnexContext])
export class KnexAppointmentExport implements AppointmentExportContract {
  constructor(private readonly database: KnexContext) {}

  /** In the order of the identifiers: stable while appointments are booked, and resumed after the last one read. */
  async export(cursor?: string): Promise<ExportedAppointmentPage> {
    const after = cursor === undefined ? undefined : decodeCursor(cursor)['id'];
    const every = tableOf(this.database);

    const rows = await (typeof after === 'string' ? every.where('id', '>', after) : every)
      .orderBy('id')
      .limit(PAGE_SIZE + 1);

    const page = rows.slice(0, PAGE_SIZE);
    const last = page.at(-1);

    return {
      appointments: page.map(exported),
      ...(rows.length > PAGE_SIZE && last !== undefined ? { nextCursor: encodeCursor({ id: last.id }) } : {}),
    };
  }

  async lookup(appointmentIds: readonly string[]): Promise<readonly ExportedAppointment[]> {
    if (appointmentIds.length === 0) {
      return [];
    }

    const rows = await tableOf(this.database)
      .whereIn('id', [...appointmentIds])
      .orderBy('id');

    return rows.map(exported);
  }
}

function exported(row: AppointmentRow): ExportedAppointment {
  return {
    appointmentId: row.id,
    calendarId: row.calendar_id,
    practiceId: row.practice_id,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    day: row.day,
    outcome: outcomeOf(row),
    changedAt: row.changed_at.toISOString(),
  };
}

/** An appointment that still holds its slot is held, requested or booked; a cancelled one says who cancelled. */
function outcomeOf(row: AppointmentRow): ExportedAppointment['outcome'] {
  switch (row.status) {
    case 'requested':
    case 'booked':
      return 'held';
    case 'cancelled':
      return row.cancelled_by === 'practice' ? 'cancelled-by-practice' : 'cancelled-by-patient';
    case 'expired':
    case 'completed':
    case 'no-show':
      return row.status;
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<AppointmentRow, AppointmentRow[]> {
  return database.executor()<AppointmentRow, AppointmentRow[]>('appointments').withSchema(SCHEDULING_SCHEMA);
}
