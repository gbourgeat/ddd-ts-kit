import { Query } from '@ddd-ts-kit/kernel';
import { Public } from '@ddd-ts-kit/kernel/declarations';
import type { GetOpeningHoursResult } from '@/contexts/scheduling/application/calendars/queries/get-opening-hours/get-opening-hours.result';

/** The weekly hours of a calendar, as anybody reads them before booking: no appointment, no person, the same for everybody. */
@Public()
export class GetOpeningHoursQuery extends Query<GetOpeningHoursResult> {
  constructor(readonly calendarId: string) {
    super();
  }
}
