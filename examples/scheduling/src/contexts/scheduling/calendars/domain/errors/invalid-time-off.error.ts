import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class InvalidTimeOff extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidTimeOff;

  static forRule(rule: string) {
    return InvalidTimeOff.refusal(`A time off ${rule}.`, { rule });
  }
}
