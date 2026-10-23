import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class InvalidBooking extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidBooking;

  static forRule(reason: string) {
    return InvalidBooking.refusal(`A booking ${reason}.`, { reason });
  }
}
