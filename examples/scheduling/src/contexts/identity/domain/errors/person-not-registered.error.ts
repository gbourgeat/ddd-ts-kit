import { DomainError } from '@ddd-ts-kit/kernel';

export class PersonNotRegisteredError extends DomainError {
  readonly code = 'PERSON_NOT_REGISTERED';

  constructor(readonly personId: string) {
    super(`The person ${personId} is not registered.`);
  }
}
