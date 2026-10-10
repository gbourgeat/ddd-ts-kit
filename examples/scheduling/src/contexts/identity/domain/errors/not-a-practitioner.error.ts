import { DomainError } from '@ddd-ts-kit/kernel';

export class NotAPractitionerError extends DomainError {
  readonly code = 'NOT_A_PRACTITIONER';

  constructor(readonly personId: string) {
    super(`The person ${personId} is not a practitioner of this practice.`);
  }
}
