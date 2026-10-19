import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class DelegationNotActive extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DelegationNotActive;

  static forDelegation(delegationId: string) {
    return DelegationNotActive.refusal(`The delegation ${delegationId} already ended.`, { delegationId });
  }
}
