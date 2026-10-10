import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetAppointmentQuery } from '../../application/queries/get-appointment/get-appointment.query.js';
import type { GetAppointmentResult } from '../../application/queries/get-appointment/get-appointment.result.js';
import { GetAppointmentParams } from './get-appointment-params.dto.js';
import { GetAppointmentAnswer } from './get-appointment-answer.dto.js';

const params = classSchema(GetAppointmentParams);
const answer = classSchema(GetAppointmentAnswer);

export function getAppointmentRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/appointments/:appointmentId',
      operationId: 'getAppointment',
      summary: 'Get appointment',
      tags: ['scheduling'],
      request: { params },
      responses: { 200: { description: 'The answer.', body: answer } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'APPOINTMENT_NOT_FOUND'],
      security: ['bearer'],
    },
    async (input) => {
      const found = await queries.execute(
        new GetAppointmentQuery(actorOf(input.context.principal), input.params.appointmentId),
      );

      return { status: 200, body: answerOf(found) };
    },
  );
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
