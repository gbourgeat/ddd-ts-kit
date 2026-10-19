import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class InvalidBooking extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidBooking;

  static forRule(reason: string) {
    return InvalidBooking.refusal(`A booking ${reason}.`, { reason });
  }
}
