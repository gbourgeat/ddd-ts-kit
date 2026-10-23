import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class PracticeLeftUnmanaged extends DomainRefusal {
  readonly code = IdentityCodes.PracticeLeftUnmanaged;

  static onRemoval() {
    return PracticeLeftUnmanaged.refusal('A practice keeps at least one manager: its last manager cannot be removed.');
  }
}
