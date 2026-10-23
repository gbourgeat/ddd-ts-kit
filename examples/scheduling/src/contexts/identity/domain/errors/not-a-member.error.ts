import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class NotAMember extends DomainRefusal {
  readonly code = IdentityCodes.NotAMember;

  static forPerson(personId: string) {
    return NotAMember.refusal(`The person ${personId} is not a member of this practice.`, {
      personId,
    });
  }
}
