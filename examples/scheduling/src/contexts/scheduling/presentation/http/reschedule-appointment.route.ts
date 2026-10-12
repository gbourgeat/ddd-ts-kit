import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RescheduleAppointmentCommand } from '@/contexts/scheduling/application/commands/reschedule-appointment/reschedule-appointment.command';
import { RescheduleAppointmentParams } from '@/contexts/scheduling/presentation/http/reschedule-appointment-params.dto';
import { RescheduleAppointmentBody } from '@/contexts/scheduling/presentation/http/reschedule-appointment-body.dto';
import { RescheduleAppointmentAccepted } from '@/contexts/scheduling/presentation/http/reschedule-appointment-accepted.dto';

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
      errors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'APPOINTMENT_NOT_FOUND',
        'APPOINTMENT_ENDED',
        'UNKNOWN_CALENDAR',
        'UNKNOWN_APPOINTMENT_TYPE',
        'OUTSIDE_AVAILABILITY',
        'OFF_GRID',
        'BOOKING_TOO_LATE',
        'BOOKING_TOO_FAR',
        'SLOT_TAKEN',
        'PATIENT_LIMIT_REACHED',
      ],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(moveOf(actorOf(input.context.principal), input.params, input.body));

      return { status: 201, body: { id } };
    },
  );
}

function moveOf(
  actor: Actor,
  { appointmentId }: RescheduleAppointmentParams,
  { startsAt }: RescheduleAppointmentBody,
): RescheduleAppointmentCommand {
  return new RescheduleAppointmentCommand(actor, appointmentId, new Date(startsAt));
}
