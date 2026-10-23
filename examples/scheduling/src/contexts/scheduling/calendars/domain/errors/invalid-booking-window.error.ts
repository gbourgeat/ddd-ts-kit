import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class InvalidBookingWindow extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidBookingWindow;

  static forRule(rule: string) {
    return InvalidBookingWindow.refusal(`A booking window ${rule}.`, { rule });
  }
}
