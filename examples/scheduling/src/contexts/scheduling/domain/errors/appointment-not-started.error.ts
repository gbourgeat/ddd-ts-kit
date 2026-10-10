import { DomainError } from '@ddd-ts-kit/kernel';

export class AppointmentNotStartedError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_STARTED';

  constructor(appointmentId: string, startsAt: Date) {
    super(`Appointment ${appointmentId} starts at ${startsAt.toISOString()}: its outcome is not known before.`);
  }
}
