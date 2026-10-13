import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RemoveAppointmentDocumentCommand } from '@/contexts/scheduling/application/commands/remove-appointment-document/remove-appointment-document.command';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';
import { RemoveAppointmentDocumentParams } from '@/contexts/scheduling/presentation/http/appointments/remove-appointment-document/remove-appointment-document.params';
import { RemoveAppointmentDocumentAccepted } from '@/contexts/scheduling/presentation/http/appointments/remove-appointment-document/remove-appointment-document.accepted';

const params = classSchema(RemoveAppointmentDocumentParams);
const accepted = classSchema(RemoveAppointmentDocumentAccepted);

@Controller({
  group: AppointmentsRoutes,
  method: 'DELETE',
  path: '/:appointmentId/document',
  summary: 'Remove the document of an appointment',
  params,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['APPOINTMENT_NOT_FOUND', 'NO_DOCUMENT'],
})
export class RemoveAppointmentDocumentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: RemoveAppointmentDocumentParams }>,
  ): Promise<RemoveAppointmentDocumentAccepted> {
    const id = await this.commands.execute(
      new RemoveAppointmentDocumentCommand(request.actor, request.params.appointmentId),
    );

    return { id };
  }
}
