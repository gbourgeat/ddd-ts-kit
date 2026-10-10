import { DomainError } from '@ddd-ts-kit/kernel';

export class UnknownAppointmentTypeError extends DomainError {
  readonly code = 'UNKNOWN_APPOINTMENT_TYPE';

  constructor(appointmentTypeId: string) {
    super(`The calendar offers no appointment type ${appointmentTypeId}.`);
  }
}
