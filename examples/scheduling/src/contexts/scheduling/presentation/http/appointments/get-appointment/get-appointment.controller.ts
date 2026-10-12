import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetAppointmentQuery } from '@/contexts/scheduling/application/queries/get-appointment/get-appointment.query';
import type { GetAppointmentResult } from '@/contexts/scheduling/application/queries/get-appointment/get-appointment.result';
import { GetAppointmentParams } from '@/contexts/scheduling/presentation/http/appointments/get-appointment/get-appointment.params';
import { GetAppointmentAnswer } from '@/contexts/scheduling/presentation/http/appointments/get-appointment/get-appointment.answer';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(GetAppointmentParams);
const answer = classSchema(GetAppointmentAnswer);

@Controller({
  group: AppointmentsRoutes,
  method: 'GET',
  path: '/:appointmentId',
  summary: 'Get appointment',
  params,
  response: { status: 200, description: 'The answer.', body: answer },
  errors: ['APPOINTMENT_NOT_FOUND'],
})
export class GetAppointmentController {
  constructor(private readonly queries: QueryBus) {}

  async handle(request: HttpRequest<{ params: GetAppointmentParams }>): Promise<GetAppointmentAnswer> {
    const found = await this.queries.execute(new GetAppointmentQuery(request.actor, request.params.appointmentId));

    return answerOf(found);
  }
}

function answerOf(item: GetAppointmentResult): GetAppointmentAnswer {
  return {
    id: item.id,
    calendarId: item.calendarId,
    practiceId: item.practiceId,
    practitionerId: item.practitionerId,
    patientId: item.patientId,
    appointmentTypeId: item.appointmentTypeId,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    day: item.day,
    status: item.status,
    ...(item.confirmBefore === null ? {} : { confirmBefore: item.confirmBefore.toISOString() }),
    ...(item.cancelledBy === null ? {} : { cancelledBy: item.cancelledBy }),
    ...(item.patientName === undefined ? {} : { patientName: item.patientName }),
  };
}
