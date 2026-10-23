import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class DelegationTooLong extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DelegationTooLong;

  static withLongestDays(longestDays: number) {
    return DelegationTooLong.refusal(`A delegation lasts ${longestDays} days at most: a longer one is a role.`, {
      longestDays,
    }).exposing('longestDays');
  }
}
