import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AddTimeOffCommand } from '@/contexts/scheduling/application/commands/add-time-off/add-time-off.command';
import { AddTimeOffParams } from '@/contexts/scheduling/presentation/http/calendars/add-time-off/add-time-off.params';
import { AddTimeOffBody } from '@/contexts/scheduling/presentation/http/calendars/add-time-off/add-time-off.body';
import { AddTimeOffAccepted } from '@/contexts/scheduling/presentation/http/calendars/add-time-off/add-time-off.accepted';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(AddTimeOffParams);
const body = classSchema(AddTimeOffBody);
const accepted = classSchema(AddTimeOffAccepted);

@Controller({
  group: CalendarsRoutes,
  method: 'POST',
  path: '/:calendarId/time-off',
  summary: 'Add time off',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_TIME_OFF', 'TIME_OFF_OVER_APPOINTMENTS'],
})
export class AddTimeOffController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: AddTimeOffParams; body: AddTimeOffBody }>): Promise<AddTimeOffAccepted> {
    const { startsAt, endsAt } = request.body;

    const id = await this.commands.execute(
      new AddTimeOffCommand(request.actor, request.params.calendarId, new Date(startsAt), new Date(endsAt)),
    );

    return { id };
  }
}
