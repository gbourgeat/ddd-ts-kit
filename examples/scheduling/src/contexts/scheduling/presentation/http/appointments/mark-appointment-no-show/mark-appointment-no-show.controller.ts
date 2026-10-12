import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { MarkAppointmentNoShowCommand } from '@/contexts/scheduling/application/commands/mark-appointment-no-show/mark-appointment-no-show.command';
import { MarkAppointmentNoShowParams } from '@/contexts/scheduling/presentation/http/appointments/mark-appointment-no-show/mark-appointment-no-show.params';
import { MarkAppointmentNoShowAccepted } from '@/contexts/scheduling/presentation/http/appointments/mark-appointment-no-show/mark-appointment-no-show.accepted';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(MarkAppointmentNoShowParams);
const accepted = classSchema(MarkAppointmentNoShowAccepted);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/no-show',
  summary: 'Mark appointment no show',
  params,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'APPOINTMENT_NOT_STARTED'],
})
export class MarkAppointmentNoShowController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: MarkAppointmentNoShowParams }>): Promise<MarkAppointmentNoShowAccepted> {
    const id = await this.commands.execute(
      new MarkAppointmentNoShowCommand(request.actor, request.params.appointmentId),
    );

    return { id };
  }
}
