import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CompleteAppointmentCommand } from '../../application/commands/complete-appointment/complete-appointment.command.js';
import { CompleteAppointmentParams } from './complete-appointment-params.dto.js';
import { CompleteAppointmentAccepted } from './complete-appointment-accepted.dto.js';

const params = classSchema(CompleteAppointmentParams);
const accepted = classSchema(CompleteAppointmentAccepted);

export function completeAppointmentRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/appointments/:appointmentId/completion',
      operationId: 'completeAppointment',
      summary: 'Complete appointment',
      tags: ['scheduling'],
      request: { params },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'APPOINTMENT_NOT_STARTED'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new CompleteAppointmentCommand(actorOf(input.context.principal), input.params.appointmentId),
      );

      return { status: 201, body: { id } };
    },
  );
}
