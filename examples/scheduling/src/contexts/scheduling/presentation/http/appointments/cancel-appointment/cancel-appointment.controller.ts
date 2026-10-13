import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/commands/cancel-appointment/cancel-appointment.command';
import { CancelAppointmentParams } from '@/contexts/scheduling/presentation/http/appointments/cancel-appointment/cancel-appointment.params';
import { CancelAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/cancel-appointment/cancel-appointment.body';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(CancelAppointmentParams);
const body = classSchema(CancelAppointmentBody);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/cancellation',
  summary: 'Cancel appointment',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'REASON_REQUIRED'],
})
export class CancelAppointmentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: CancelAppointmentParams; body: CancelAppointmentBody }>,
  ): Promise<Accepted> {
    const id = await this.commands.execute(
      new CancelAppointmentCommand(request.actor, request.params.appointmentId, request.body.reason),
    );

    return { id };
  }
}
