import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class InvalidOffer extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidOffer;

  static forRule(rule: string) {
    return InvalidOffer.refusal(`An offer ${rule}.`, { rule });
  }
}
