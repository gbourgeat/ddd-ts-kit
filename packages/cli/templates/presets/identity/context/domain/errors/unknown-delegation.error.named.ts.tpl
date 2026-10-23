import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class UnknownDelegation extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.UnknownDelegation;

  static forDelegation(delegationId: string) {
    return UnknownDelegation.refusal(`No delegation ${delegationId}.`, { delegationId }).exposing('delegationId');
  }
}
