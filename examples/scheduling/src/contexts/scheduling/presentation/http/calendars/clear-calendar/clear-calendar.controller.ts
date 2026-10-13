import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ClearCalendarCommand } from '@/contexts/scheduling/application/commands/clear-calendar/clear-calendar.command';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';
import { ClearCalendarParams } from '@/contexts/scheduling/presentation/http/calendars/clear-calendar/clear-calendar.params';
import { ClearCalendarBody } from '@/contexts/scheduling/presentation/http/calendars/clear-calendar/clear-calendar.body';
import { ClearCalendarAccepted } from '@/contexts/scheduling/presentation/http/calendars/clear-calendar/clear-calendar.accepted';

const params = classSchema(ClearCalendarParams);
const body = classSchema(ClearCalendarBody);
const accepted = classSchema(ClearCalendarAccepted);

@Controller({
  group: CalendarsRoutes,
  method: 'POST',
  path: '/:calendarId/clearances',
  summary: 'Clear calendar',
  params,
  body,
  response: {
    status: 202,
    description: 'Accepted: a worker cancels the appointments of the period; the body carries the clearance to follow.',
    body: accepted,
  },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_TIME_OFF'],
})
export class ClearCalendarController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: ClearCalendarParams; body: ClearCalendarBody }>,
  ): Promise<ClearCalendarAccepted> {
    const { startsAt, endsAt, reason } = request.body;

    const id = await this.commands.execute(
      new ClearCalendarCommand(request.actor, request.params.calendarId, new Date(startsAt), new Date(endsAt), reason),
    );

    return { id };
  }
}
