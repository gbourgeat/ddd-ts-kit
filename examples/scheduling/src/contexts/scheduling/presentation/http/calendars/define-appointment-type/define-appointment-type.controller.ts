import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DefineAppointmentTypeCommand } from '@/contexts/scheduling/application/calendars/commands/define-appointment-type/define-appointment-type.command';
import { DefineAppointmentTypeParams } from '@/contexts/scheduling/presentation/http/calendars/define-appointment-type/define-appointment-type.params';
import { DefineAppointmentTypeBody } from '@/contexts/scheduling/presentation/http/calendars/define-appointment-type/define-appointment-type.body';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(DefineAppointmentTypeParams);
const body = classSchema(DefineAppointmentTypeBody);

@Controller({
  group: CalendarsRoutes,
  method: 'POST',
  path: '/:calendarId/appointment-types',
  summary: 'Define appointment type',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_APPOINTMENT_TYPE'],
})
export class DefineAppointmentTypeController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: DefineAppointmentTypeParams; body: DefineAppointmentTypeBody }>,
  ): Promise<Accepted> {
    const { name, duration, grid, buffer, needsConfirmation } = request.body;
    const facts = { name, duration, grid, buffer, needsConfirmation };

    const id = await this.commands.execute(
      new DefineAppointmentTypeCommand(request.actor, request.params.calendarId, facts),
    );

    return { id };
  }
}
