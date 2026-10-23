import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class DelegationWithNoRight extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DelegationWithNoRight;

  static withNoRight() {
    return DelegationWithNoRight.refusal('A delegation lends at least one right.');
  }
}
