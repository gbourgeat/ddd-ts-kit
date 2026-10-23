import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class UnknownCalendar extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownCalendar;

  static forCalendar(calendarId: string) {
    return UnknownCalendar.refusal(`There is no calendar ${calendarId}.`, { calendarId });
  }
}
