import { Controller, withFieldAccess, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetAppointmentQuery } from '@/contexts/scheduling/application/queries/get-appointment/get-appointment.query';
import type { GetAppointmentResult } from '@/contexts/scheduling/application/queries/get-appointment/get-appointment.result';
import { GetAppointmentParams } from '@/contexts/scheduling/presentation/http/appointments/get-appointment/get-appointment.params';
import { GetAppointmentAnswer } from '@/contexts/scheduling/presentation/http/appointments/get-appointment/get-appointment.answer';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

const params = classSchema(GetAppointmentParams);

// The internal note is the staff's: an answer to the patient leaves it out, in every representation.
const answer = withFieldAccess(classSchema(GetAppointmentAnswer), {
  internalNote: {
    read: { permission: schedulingPermissions['appointment.note.read'] },
    subject: (appointment) => ({ type: 'calendar', id: appointment.calendarId }),
  },
});

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
    ...(item.internalNote === null ? {} : { internalNote: item.internalNote }),
  };
}
