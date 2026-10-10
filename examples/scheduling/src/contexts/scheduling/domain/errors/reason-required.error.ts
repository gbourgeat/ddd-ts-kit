import { DomainError } from '@ddd-ts-kit/kernel';

export class ReasonRequiredError extends DomainError {
  readonly code = 'REASON_REQUIRED';

  constructor() {
    super('The practice gives a reason when it cancels an appointment.');
  }
}
