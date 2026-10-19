import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { AnalyticsCodes } from '@/contexts/analytics/domain/errors/codes';

export class OutcomePeriodInverted extends DomainRefusal {
  readonly code = AnalyticsCodes.OutcomePeriodInverted;

  static forPeriod(startsAt: string, endsAt: string) {
    return OutcomePeriodInverted.refusal(
      `An outcome cannot end at ${endsAt}, before it starts at ${startsAt}: the time it covers would be negative.`,
      { startsAt, endsAt },
    );
  }
}
