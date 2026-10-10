import { DomainError } from '@ddd-ts-kit/kernel';

export class UnknownPractitionerError extends DomainError {
  readonly code = 'UNKNOWN_PRACTITIONER';

  constructor(practiceId: string, practitionerId: string) {
    super(`The person ${practitionerId} is not a practitioner of the practice ${practiceId}.`);
  }
}
