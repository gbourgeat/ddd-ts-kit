import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/commands/cancel-appointment/cancel-appointment.command';
import { CancelAppointmentParams } from '@/contexts/scheduling/presentation/http/cancel-appointment-params.dto';
import { CancelAppointmentBody } from '@/contexts/scheduling/presentation/http/cancel-appointment-body.dto';
import { CancelAppointmentAccepted } from '@/contexts/scheduling/presentation/http/cancel-appointment-accepted.dto';

const params = classSchema(CancelAppointmentParams);
const body = classSchema(CancelAppointmentBody);
const accepted = classSchema(CancelAppointmentAccepted);

export function cancelAppointmentRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/appointments/:appointmentId/cancellation',
      operationId: 'cancelAppointment',
      summary: 'Cancel appointment',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'REASON_REQUIRED'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new CancelAppointmentCommand(actorOf(input.context.principal), input.params.appointmentId, input.body.reason),
      );

      return { status: 201, body: { id } };
    },
  );
}
