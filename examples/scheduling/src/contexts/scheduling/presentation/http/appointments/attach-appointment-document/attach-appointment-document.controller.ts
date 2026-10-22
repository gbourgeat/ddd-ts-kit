import { acceptedSchema, Controller, type Accepted, type HttpRequest, type IncomingFile } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AttachAppointmentDocumentCommand } from '@/contexts/scheduling/application/calendars/commands/attach-appointment-document/attach-appointment-document.command';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';
import { AttachAppointmentDocumentParams } from '@/contexts/scheduling/presentation/http/appointments/attach-appointment-document/attach-appointment-document.params';

const params = classSchema(AttachAppointmentDocumentParams);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/document',
  summary: 'Attach a document to an appointment',
  description:
    'A referral, a prescription or a report, as `multipart/form-data`: it replaces the document the appointment held.',
  params,
  upload: { field: 'document', maxBytes: 10_485_760, mediaTypes: ['application/pdf', 'image/png', 'image/jpeg'] },
  response: {
    status: 201,
    description: 'Attached; the body carries the identifier of the appointment.',
    body: acceptedSchema,
  },
  errors: ['APPOINTMENT_NOT_FOUND', 'DOCUMENT_NAME_TOO_LONG', 'FILE_REJECTED'],
})
export class AttachAppointmentDocumentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: AttachAppointmentDocumentParams; upload: IncomingFile }>,
  ): Promise<Accepted> {
    const { actor, params: path, upload } = request;

    await this.commands.execute(new AttachAppointmentDocumentCommand(actor, path.appointmentId, upload));

    return { id: path.appointmentId };
  }
}
