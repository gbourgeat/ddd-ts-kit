import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class InvalidRange extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidRange;

  static forRule(rule: string) {
    return InvalidRange.refusal(`A range ${rule}.`, { rule });
  }
}
