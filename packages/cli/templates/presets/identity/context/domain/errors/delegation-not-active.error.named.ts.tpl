import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class DelegationNotActive extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DelegationNotActive;

  static forDelegation(delegationId: string) {
    return DelegationNotActive.refusal(`The delegation ${delegationId} already ended.`, { delegationId });
  }
}
