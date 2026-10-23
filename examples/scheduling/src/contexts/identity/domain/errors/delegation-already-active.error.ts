import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class DelegationAlreadyActive extends DomainRefusal {
  readonly code = IdentityCodes.DelegationAlreadyActive;

  static forDelegation(delegationId: string) {
    return DelegationAlreadyActive.refusal(
      `This practitioner already delegates to this assistant (delegation ${delegationId}).`,
      { delegationId },
    );
  }
}
