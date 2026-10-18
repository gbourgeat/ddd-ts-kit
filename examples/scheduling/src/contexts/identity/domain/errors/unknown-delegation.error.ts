import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/domain/errors/codes';

export class UnknownDelegation extends DomainRefusal {
  readonly code = IdentityCodes.UnknownDelegation;

  static forDelegation(delegationId: string) {
    return UnknownDelegation.refusal(`The delegation ${delegationId} does not exist on this desk.`, { delegationId });
  }
}
