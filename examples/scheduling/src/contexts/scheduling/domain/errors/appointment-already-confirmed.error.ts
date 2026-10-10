import { DomainError } from '@ddd-ts-kit/kernel';

export class AppointmentAlreadyConfirmedError extends DomainError {
  readonly code = 'APPOINTMENT_ALREADY_CONFIRMED';

  constructor(appointmentId: string) {
    super(`Appointment ${appointmentId} is booked: nothing is left to confirm.`);
  }
}
