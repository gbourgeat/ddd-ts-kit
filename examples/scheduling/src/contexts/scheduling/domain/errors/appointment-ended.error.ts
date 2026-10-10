import { DomainError } from '@ddd-ts-kit/kernel';

export class AppointmentEndedError extends DomainError {
  readonly code = 'APPOINTMENT_ENDED';

  constructor(appointmentId: string, status: string) {
    super(`Appointment ${appointmentId} is ${status} and does not change any more.`);
  }
}
