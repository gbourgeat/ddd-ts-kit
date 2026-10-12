import { ConceptError } from '@ddd-ts-kit/kernel';

export class PersonError extends ConceptError {
  static invalidDisplayName() {
    return PersonError.refusal('INVALID_DISPLAY_NAME', 'A display name holds between 1 and 120 characters.');
  }

  static invalidEmail(value: string) {
    return PersonError.refusal('INVALID_EMAIL', `"${value}" is not an address the platform can write to.`, { value });
  }

  static notRegistered(personId: string) {
    return PersonError.refusal('PERSON_NOT_REGISTERED', `The person ${personId} is not registered.`, { personId });
  }
}
