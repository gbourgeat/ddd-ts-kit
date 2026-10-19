import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class OutsideAvailability extends DomainRefusal {
  readonly code = SchedulingCodes.OutsideAvailability;

  static atStart(startsAt: Date) {
    return OutsideAvailability.refusal(`The calendar takes no appointment at ${startsAt.toISOString()}.`, {
      startsAt,
    }).exposing('startsAt');
  }
}
