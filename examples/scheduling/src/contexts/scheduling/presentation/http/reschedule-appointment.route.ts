import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RescheduleAppointmentCommand } from '../../application/commands/reschedule-appointment/reschedule-appointment.command.js';
import { RescheduleAppointmentParams } from './reschedule-appointment-params.dto.js';
import { RescheduleAppointmentBody } from './reschedule-appointment-body.dto.js';
import { RescheduleAppointmentAccepted } from './reschedule-appointment-accepted.dto.js';

const params = classSchema(RescheduleAppointmentParams);
const body = classSchema(RescheduleAppointmentBody);
const accepted = classSchema(RescheduleAppointmentAccepted);

export function rescheduleAppointmentRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/appointments/:appointmentId/reschedule',
      operationId: 'rescheduleAppointment',
      summary: 'Reschedule appointment',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'UNKNOWN_CALENDAR', 'UNKNOWN_APPOINTMENT_TYPE', 'OUTSIDE_AVAILABILITY', 'OFF_GRID', 'BOOKING_TOO_LATE', 'BOOKING_TOO_FAR', 'SLOT_TAKEN', 'PATIENT_LIMIT_REACHED'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(new RescheduleAppointmentCommand(actorOf(input.context.principal), input.params.appointmentId, new Date(input.body.startsAt)));

      return { status: 201, body: { id } };
    },
  );
}
