import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetAppointmentDocumentQuery } from '@/contexts/scheduling/application/calendars/queries/get-appointment-document/get-appointment-document.query';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';
import { GetAppointmentDocumentAnswer } from '@/contexts/scheduling/presentation/http/appointments/get-appointment-document/get-appointment-document.answer';
import { GetAppointmentDocumentParams } from '@/contexts/scheduling/presentation/http/appointments/get-appointment-document/get-appointment-document.params';

const params = classSchema(GetAppointmentDocumentParams);
const answer = classSchema(GetAppointmentDocumentAnswer);

@Controller({
  group: AppointmentsRoutes,
  method: 'GET',
  path: '/:appointmentId/document',
  summary: 'Get a link to the document of an appointment',
  description:
    'The file itself is fetched from the link it answers, which expires after five minutes; every access is recorded in the audit trail.',
  params,
  response: { status: 200, description: 'The link to the document.', body: answer },
  errors: ['APPOINTMENT_NOT_FOUND', 'NO_DOCUMENT'],
})
export class GetAppointmentDocumentController {
  constructor(private readonly queries: QueryBus) {}

  async handle(request: HttpRequest<{ params: GetAppointmentDocumentParams }>): Promise<GetAppointmentDocumentAnswer> {
    const found = await this.queries.execute(
      new GetAppointmentDocumentQuery(request.actor, request.params.appointmentId),
    );

    return { ...found, expiresAt: found.expiresAt.toISOString() };
  }
}
