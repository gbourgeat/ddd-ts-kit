import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CreateCalendarCommand } from '@/contexts/scheduling/application/calendars/commands/create-calendar/create-calendar.command';
import { CreateCalendarBody } from '@/contexts/scheduling/presentation/http/calendars/create-calendar/create-calendar.body';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const body = classSchema(CreateCalendarBody);

@Controller({
  group: CalendarsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Create calendar',
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['UNKNOWN_PRACTITIONER', 'UNKNOWN_TIME_ZONE'],
})
export class CreateCalendarController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ body: CreateCalendarBody }>): Promise<Accepted> {
    const { practiceId, practitionerId } = request.body;

    const id = await this.commands.execute(new CreateCalendarCommand(request.actor, practiceId, practitionerId));

    return { id };
  }
}
