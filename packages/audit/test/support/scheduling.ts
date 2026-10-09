import { AuthorizedCommand, AuthorizedQuery, DomainError, type Actor } from '@ddd-ts-kit/kernel';

export class AppointmentAlreadyCancelled extends DomainError {
  readonly code = 'APPOINTMENT_ALREADY_CANCELLED';
}

export interface Rescheduling {
  readonly appointmentId: string;
  readonly status: 'confirmed' | 'cancelled';
  readonly startsAt: Date;
  readonly patientEmail: string;
  /** Free text: what the audit trail must never hold. */
  readonly note: string;
}

export class RescheduleAppointmentCommand extends AuthorizedCommand<string> {
  readonly appointmentId: string;
  readonly status: 'confirmed' | 'cancelled';
  readonly startsAt: Date;
  readonly patientEmail: string;
  readonly note: string;

  constructor(actor: Actor, rescheduling: Rescheduling) {
    super(actor);
    this.appointmentId = rescheduling.appointmentId;
    this.status = rescheduling.status;
    this.startsAt = rescheduling.startsAt;
    this.patientEmail = rescheduling.patientEmail;
    this.note = rescheduling.note;
  }
}

export class CancelAppointmentCommand extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

export class ListAppointmentsQuery extends AuthorizedQuery<readonly string[]> {}

/** A query whose name does not say so. */
export class UpcomingAppointments extends AuthorizedQuery<readonly string[]> {}

/** A command whose name ends like a query. */
export class SaveSearchQuery extends AuthorizedCommand {}

export class ReadMedicalFileQuery extends AuthorizedQuery<string> {
  constructor(
    actor: Actor,
    readonly patientId: string,
  ) {
    super(actor);
  }
}

export function aRescheduling(more: Partial<Rescheduling> = {}): Rescheduling {
  return {
    appointmentId: 'apt-1',
    status: 'confirmed',
    startsAt: new Date('2026-03-04T09:30:00.000Z'),
    patientEmail: 'lin@example.org',
    note: 'Patient asked to come later because of a family matter',
    ...more,
  };
}
