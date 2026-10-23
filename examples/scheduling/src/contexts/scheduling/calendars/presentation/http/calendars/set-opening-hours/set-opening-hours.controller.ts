import { acceptedSchema, Controller, IfMatch, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SetOpeningHoursCommand } from '@/contexts/scheduling/calendars/application/commands/set-opening-hours/set-opening-hours.command';
import { SetOpeningHoursParams } from '@/contexts/scheduling/calendars/presentation/http/calendars/set-opening-hours/set-opening-hours.params';
import { SetOpeningHoursBody } from '@/contexts/scheduling/calendars/presentation/http/calendars/set-opening-hours/set-opening-hours.body';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(SetOpeningHoursParams);
const body = classSchema(SetOpeningHoursBody);

@Controller({
  group: CalendarsRoutes,
  method: 'PUT',
  path: '/:calendarId/opening-hours',
  summary: 'Set opening hours',
  params,
  body,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_RANGE'],
  // The ETag of GET /calendars/:calendarId/opening-hours: a change made on hours somebody changed since answers 412.
  ifMatch: IfMatch.optional,
})
export class SetOpeningHoursController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: SetOpeningHoursParams; body: SetOpeningHoursBody }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new SetOpeningHoursCommand(
        request.actor,
        request.params.calendarId,
        request.body.ranges,
        request.context.expectedVersion,
      ),
    );

    return { id };
  }
}
