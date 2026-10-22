import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class InvalidDay extends DomainRefusal {
  readonly code = SchedulingCodes.InvalidDay;

  static forDay(day: string) {
    return InvalidDay.refusal(`${day} is not a day written YYYY-MM-DD.`, { day }).exposing('day');
  }
}
