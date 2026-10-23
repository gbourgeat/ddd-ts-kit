import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class AlreadyMember extends DomainRefusal {
  readonly code = IdentityCodes.AlreadyMember;

  static forPerson(personId: string) {
    return AlreadyMember.refusal(`The person ${personId} is already a member of this practice.`, {
      personId,
    });
  }
}
