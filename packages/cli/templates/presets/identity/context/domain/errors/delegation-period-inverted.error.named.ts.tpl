import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class DelegationPeriodInverted extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.DelegationPeriodInverted;

  static forPeriod(startsAt: Date, endsAt: Date) {
    return DelegationPeriodInverted.refusal('A delegation ends after it starts.', {
      startsAt,
      endsAt,
    }).exposing('startsAt', 'endsAt');
  }
}
