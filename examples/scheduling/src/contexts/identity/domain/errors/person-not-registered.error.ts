import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class PersonNotRegistered extends DomainRefusal {
  readonly code = IdentityCodes.PersonNotRegistered;

  static forPerson(personId: string) {
    return PersonNotRegistered.refusal(`The person ${personId} is not registered.`, { personId });
  }
}
