import { DomainError } from '@ddd-ts-kit/kernel';

export class AppointmentNotFoundError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_FOUND';

  constructor(appointmentId: string) {
    super(`Appointment ${appointmentId} does not exist.`);
  }
}
