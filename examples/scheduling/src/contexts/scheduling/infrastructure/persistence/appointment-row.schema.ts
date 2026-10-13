import type { AuditRow, TenantRow } from '@ddd-ts-kit/knex';

/** The exclusion constraint that holds a time on a calendar once, as PostgreSQL names it in a violation. */
export const APPOINTMENT_SLOT_HELD_ONCE = 'appointments_slot_held_once';

export interface AppointmentColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly changed_at: Date;
  readonly calendar_id: string;
  readonly practice_id: string;
  readonly practitioner_id: string;
  readonly patient_id: string;
  readonly appointment_type_id: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly held_until: Date;
  readonly day: string;
  readonly status: 'requested' | 'booked' | 'cancelled' | 'expired' | 'completed' | 'no-show';
  readonly confirm_before: Date | null;
  readonly cancelled_by: 'patient' | 'practice' | null;
  readonly cancellation_reason: string | null;
}

export interface AppointmentRow extends AppointmentColumns, TenantRow, AuditRow {
  readonly version: number;
}
