import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SetOpeningHoursCommand } from '@/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.command';
import { SetOpeningHoursParams } from '@/contexts/scheduling/presentation/http/calendars/set-opening-hours/set-opening-hours.params';
import { SetOpeningHoursBody } from '@/contexts/scheduling/presentation/http/calendars/set-opening-hours/set-opening-hours.body';
import { SetOpeningHoursAccepted } from '@/contexts/scheduling/presentation/http/calendars/set-opening-hours/set-opening-hours.accepted';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(SetOpeningHoursParams);
const body = classSchema(SetOpeningHoursBody);
const accepted = classSchema(SetOpeningHoursAccepted);

@Controller({
  group: CalendarsRoutes,
  method: 'PUT',
  path: '/:calendarId/opening-hours',
  summary: 'Set opening hours',
  params,
  body,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_RANGE'],
})
export class SetOpeningHoursController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: SetOpeningHoursParams; body: SetOpeningHoursBody }>,
  ): Promise<SetOpeningHoursAccepted> {
    const id = await this.commands.execute(
      new SetOpeningHoursCommand(request.actor, request.params.calendarId, request.body.ranges),
    );

    return { id };
  }
}
