import { DomainError } from '@ddd-ts-kit/kernel';

export class AlreadyWaitingError extends DomainError {
  readonly code = 'ALREADY_WAITING';

  constructor(patientId: string) {
    super(`The patient ${patientId} is already on this waitlist.`);
  }
}
