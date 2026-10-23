import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class InvalidWaiter extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidWaiter;

  static forRule(rule: string) {
    return InvalidWaiter.refusal(`A waiter ${rule}.`, { rule });
  }
}
