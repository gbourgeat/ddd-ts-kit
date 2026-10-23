import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RemoveAppointmentDocumentCommand } from '@/contexts/scheduling/calendars/application/commands/remove-appointment-document/remove-appointment-document.command';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';
import { RemoveAppointmentDocumentParams } from '@/contexts/scheduling/calendars/presentation/http/appointments/remove-appointment-document/remove-appointment-document.params';

const params = classSchema(RemoveAppointmentDocumentParams);

@Controller({
  group: AppointmentsRoutes,
  method: 'DELETE',
  path: '/:appointmentId/document',
  summary: 'Remove the document of an appointment',
  params,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['APPOINTMENT_NOT_FOUND', 'NO_DOCUMENT'],
})
export class RemoveAppointmentDocumentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: RemoveAppointmentDocumentParams }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new RemoveAppointmentDocumentCommand(request.actor, request.params.appointmentId),
    );

    return { id };
  }
}
