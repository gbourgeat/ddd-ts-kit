import { DomainError } from '@ddd-ts-kit/kernel';

export class AppointmentAlreadyCancelled extends DomainError {
  readonly code = 'APPOINTMENT_ALREADY_CANCELLED';
}
