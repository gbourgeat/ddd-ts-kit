import type { Knex } from 'knex';
import { type Clock, type ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import { AppointmentMapper } from '@/contexts/scheduling/infrastructure/persistence/appointment.mapper';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import {
  APPOINTMENT_SLOT_HELD_ONCE,
  type AppointmentColumns,
  type AppointmentRow,
} from '@/contexts/scheduling/infrastructure/persistence/appointment-row.schema';
import { AppointmentStatus } from '@/contexts/scheduling/domain/vocabularies/appointment-status.vocabulary';

type VersionedAppointment = AppointmentColumns & { readonly version: number };

const ACTIVE = [AppointmentStatus.Requested, AppointmentStatus.Booked];
/** The SQLSTATE of PostgreSQL for a violated exclusion constraint. */
const EXCLUSION_VIOLATION = '23P01';
/** The SQLSTATE of PostgreSQL for the transaction it ends to break a deadlock. */
const DEADLOCK_DETECTED = '40P01';

@Repository(AppointmentRepository)
export class KnexAppointmentRepository implements AppointmentRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Appointment | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : AppointmentMapper.toDomain(row);
  }

  async heldOn(calendarId: string, from: Date, until: Date): Promise<readonly Appointment[]> {
    const rows = await tableOf(this.database)
      .where({ calendar_id: calendarId })
      .whereIn('status', ACTIVE)
      .where('starts_at', '<', until)
      .where('held_until', '>', from)
      .orderBy('starts_at');

    return rows.map((row) => AppointmentMapper.toDomain(row));
  }

  async heldBy(patientId: string, practitionerId: string, instant: Date): Promise<readonly Appointment[]> {
    const rows = await tableOf(this.database)
      .where({ patient_id: patientId, practitioner_id: practitionerId })
      .whereIn('status', ACTIVE)
      .where('starts_at', '>', instant)
      .orderBy('starts_at');

    return rows.map((row) => AppointmentMapper.toDomain(row));
  }

  async unconfirmedAt(instant: Date): Promise<readonly Appointment[]> {
    const rows = await tableOf(this.database)
      .where({ status: AppointmentStatus.Requested })
      .where('confirm_before', '<=', instant)
      .orderBy('confirm_before');

    return rows.map((row) => AppointmentMapper.toDomain(row));
  }

  /** The storage decides between two bookings of one slot: the one it refuses is told so in the words of the domain, not as a fault. */
  async save(saved: Appointment): Promise<void> {
    try {
      await optimisticUpdate(saved, async ({ expected, next }) => {
        const state = { ...AppointmentMapper.toRow(saved), version: next };

        return expected === 0 ? this.insert(state) : this.update(state, expected);
      });
    } catch (error) {
      if (isSlotHeldTwice(error) || (saved.isActive && isDeadlock(error))) {
        throw AppointmentError.slotTaken(saved.calendarId, saved.slot.startsAt);
      }

      throw error;
    }
  }

  private async insert(state: VersionedAppointment): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    return (await insertIgnoringConflict(this.database.executor(), tableOf(this.database), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private async update(state: VersionedAppointment, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<AppointmentRow, AppointmentRow[]> {
  return database.executor()<AppointmentRow, AppointmentRow[]>('appointments').withSchema(SCHEDULING_SCHEMA);
}

function isSlotHeldTwice(error: unknown): boolean {
  return (
    sqlStateOf(error) === EXCLUSION_VIOLATION &&
    typeof error === 'object' &&
    error !== null &&
    'constraint' in error &&
    error.constraint === APPOINTMENT_SLOT_HELD_ONCE
  );
}

/**
 * Two transactions that write overlapping slots at the same instant each wait for the other to
 * end before the constraint can answer: the server ends one of them, and the other holds the slot.
 */
function isDeadlock(error: unknown): boolean {
  return sqlStateOf(error) === DEADLOCK_DETECTED;
}

function sqlStateOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}
