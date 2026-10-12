import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { MarkAppointmentNoShowCommand } from '@/contexts/scheduling/application/commands/mark-appointment-no-show/mark-appointment-no-show.command';
import { MarkAppointmentNoShowParams } from '@/contexts/scheduling/presentation/http/mark-appointment-no-show-params.dto';
import { MarkAppointmentNoShowAccepted } from '@/contexts/scheduling/presentation/http/mark-appointment-no-show-accepted.dto';

const params = classSchema(MarkAppointmentNoShowParams);
const accepted = classSchema(MarkAppointmentNoShowAccepted);

export function markAppointmentNoShowRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/appointments/:appointmentId/no-show',
      operationId: 'markAppointmentNoShow',
      summary: 'Mark appointment no show',
      tags: ['scheduling'],
      request: { params },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'APPOINTMENT_NOT_FOUND', 'APPOINTMENT_ENDED', 'APPOINTMENT_NOT_STARTED'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new MarkAppointmentNoShowCommand(actorOf(input.context.principal), input.params.appointmentId),
      );

      return { status: 201, body: { id } };
    },
  );
}
