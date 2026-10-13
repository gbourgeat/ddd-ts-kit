import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ConfirmAppointmentCommand } from '@/contexts/scheduling/application/commands/confirm-appointment/confirm-appointment.command';
import { ConfirmAppointmentParams } from '@/contexts/scheduling/presentation/http/appointments/confirm-appointment/confirm-appointment.params';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(ConfirmAppointmentParams);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/confirmation',
  summary: 'Confirm appointment',
  params,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'APPOINTMENT_ALREADY_CONFIRMED'],
})
export class ConfirmAppointmentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: ConfirmAppointmentParams }>): Promise<Accepted> {
    const id = await this.commands.execute(new ConfirmAppointmentCommand(request.actor, request.params.appointmentId));

    return { id };
  }
}
