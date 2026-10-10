import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidAppointmentTypeError extends DomainError {
  readonly code = 'INVALID_APPOINTMENT_TYPE';

  constructor(rule: string) {
    super(`An appointment type ${rule}.`);
  }
}
