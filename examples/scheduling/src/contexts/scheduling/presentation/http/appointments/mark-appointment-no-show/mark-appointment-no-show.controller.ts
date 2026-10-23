import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { MarkAppointmentNoShowCommand } from '@/contexts/scheduling/application/calendars/commands/mark-appointment-no-show/mark-appointment-no-show.command';
import { MarkAppointmentNoShowParams } from '@/contexts/scheduling/presentation/http/appointments/mark-appointment-no-show/mark-appointment-no-show.params';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(MarkAppointmentNoShowParams);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/no-show',
  summary: 'Mark appointment no show',
  params,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'APPOINTMENT_NOT_STARTED'],
})
export class MarkAppointmentNoShowController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: MarkAppointmentNoShowParams }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new MarkAppointmentNoShowCommand(request.actor, request.params.appointmentId),
    );

    return { id };
  }
}
