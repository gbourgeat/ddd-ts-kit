import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class NotAnAssistant extends DomainRefusal {
  readonly code = IdentityCodes.NotAnAssistant;

  static forPerson(personId: string) {
    return NotAnAssistant.refusal(`The person ${personId} is not an assistant of this practice.`, {
      personId,
    });
  }
}
