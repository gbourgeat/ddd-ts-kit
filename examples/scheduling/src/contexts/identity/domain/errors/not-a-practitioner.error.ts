import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class NotAPractitioner extends DomainRefusal {
  readonly code = IdentityCodes.NotAPractitioner;

  static forPerson(personId: string) {
    return NotAPractitioner.refusal(`The person ${personId} is not a practitioner of this practice.`, { personId });
  }
}
