import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

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
