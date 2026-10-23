import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { JoinWaitlistCommand } from '@/contexts/scheduling/application/waitlist/commands/join-waitlist/join-waitlist.command';
import { JoinWaitlistParams } from '@/contexts/scheduling/presentation/http/calendars/join-waitlist/join-waitlist.params';
import { JoinWaitlistBody } from '@/contexts/scheduling/presentation/http/calendars/join-waitlist/join-waitlist.body';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(JoinWaitlistParams);
const body = classSchema(JoinWaitlistBody);

@Controller({
  group: CalendarsRoutes,
  method: 'POST',
  path: '/:calendarId/waitlist',
  summary: 'Join waitlist',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['UNKNOWN_CALENDAR', 'UNKNOWN_APPOINTMENT_TYPE', 'INVALID_DAY', 'ALREADY_WAITING'],
})
export class JoinWaitlistController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: JoinWaitlistParams; body: JoinWaitlistBody }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new JoinWaitlistCommand(request.actor, request.params.calendarId, waitOf(request.body)),
    );

    return { id };
  }
}

function waitOf({ patientId, appointmentTypeId, day }: JoinWaitlistBody): JoinWaitlistCommand['wait'] {
  return { patientId, appointmentTypeId, day };
}
