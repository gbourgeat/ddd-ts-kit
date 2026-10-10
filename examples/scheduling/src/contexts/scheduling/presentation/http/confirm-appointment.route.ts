import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ConfirmAppointmentCommand } from '#src/contexts/scheduling/application/commands/confirm-appointment/confirm-appointment.command.js';
import { ConfirmAppointmentParams } from '#src/contexts/scheduling/presentation/http/confirm-appointment-params.dto.js';
import { ConfirmAppointmentAccepted } from '#src/contexts/scheduling/presentation/http/confirm-appointment-accepted.dto.js';

const params = classSchema(ConfirmAppointmentParams);
const accepted = classSchema(ConfirmAppointmentAccepted);

export function confirmAppointmentRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/appointments/:appointmentId/confirmation',
      operationId: 'confirmAppointment',
      summary: 'Confirm appointment',
      tags: ['scheduling'],
      request: { params },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'APPOINTMENT_NOT_FOUND',
        'APPOINTMENT_ENDED',
        'APPOINTMENT_ALREADY_CONFIRMED',
      ],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new ConfirmAppointmentCommand(actorOf(input.context.principal), input.params.appointmentId),
      );

      return { status: 201, body: { id } };
    },
  );
}
