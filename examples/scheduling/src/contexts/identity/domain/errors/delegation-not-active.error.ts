import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { IdentityCodes } from '@/contexts/identity/identity.codes';

export class DelegationNotActive extends DomainRefusal {
  readonly code = IdentityCodes.DelegationNotActive;

  static forDelegation(delegationId: string) {
    return DelegationNotActive.refusal(`The delegation ${delegationId} already ended.`, {
      delegationId,
    });
  }
}
