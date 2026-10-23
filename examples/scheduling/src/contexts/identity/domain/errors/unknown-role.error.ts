import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class UnknownRole extends DomainRefusal {
  readonly code = IdentityCodes.UnknownRole;

  static forName(value: string) {
    return UnknownRole.refusal(`"${value}" is not a role of a practice: manager, practitioner or assistant.`, {
      value,
    });
  }
}
