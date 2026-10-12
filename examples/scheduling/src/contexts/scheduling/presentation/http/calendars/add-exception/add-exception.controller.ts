import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AddExceptionCommand } from '@/contexts/scheduling/application/commands/add-exception/add-exception.command';
import { AddExceptionParams } from '@/contexts/scheduling/presentation/http/calendars/add-exception/add-exception.params';
import { AddExceptionBody } from '@/contexts/scheduling/presentation/http/calendars/add-exception/add-exception.body';
import { AddExceptionAccepted } from '@/contexts/scheduling/presentation/http/calendars/add-exception/add-exception.accepted';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(AddExceptionParams);
const body = classSchema(AddExceptionBody);
const accepted = classSchema(AddExceptionAccepted);

@Controller({
  group: CalendarsRoutes,
  method: 'POST',
  path: '/:calendarId/exceptions',
  summary: 'Add exception',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_DAY', 'INVALID_RANGE'],
})
export class AddExceptionController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: AddExceptionParams; body: AddExceptionBody }>,
  ): Promise<AddExceptionAccepted> {
    const { day, ranges } = request.body;

    const id = await this.commands.execute(
      new AddExceptionCommand(request.actor, request.params.calendarId, day, ranges),
    );

    return { id };
  }
}
