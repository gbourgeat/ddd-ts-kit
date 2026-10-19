import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class InvalidDisplayName extends DomainRefusal {
  readonly code = IdentityCodes.InvalidDisplayName;

  static becauseOfLength() {
    return InvalidDisplayName.refusal('A display name holds between 1 and 120 characters.');
  }
}
