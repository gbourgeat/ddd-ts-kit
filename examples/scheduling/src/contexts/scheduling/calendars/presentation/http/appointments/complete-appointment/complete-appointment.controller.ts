import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CompleteAppointmentCommand } from '@/contexts/scheduling/calendars/application/commands/complete-appointment/complete-appointment.command';
import { CompleteAppointmentParams } from '@/contexts/scheduling/calendars/presentation/http/appointments/complete-appointment/complete-appointment.params';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(CompleteAppointmentParams);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/completion',
  summary: 'Complete appointment',
  params,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'APPOINTMENT_NOT_STARTED'],
})
export class CompleteAppointmentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: CompleteAppointmentParams }>): Promise<Accepted> {
    const id = await this.commands.execute(new CompleteAppointmentCommand(request.actor, request.params.appointmentId));

    return { id };
  }
}
