import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DefineAppointmentTypeCommand } from '@/contexts/scheduling/application/commands/define-appointment-type/define-appointment-type.command.js';
import { DefineAppointmentTypeParams } from '@/contexts/scheduling/presentation/http/define-appointment-type-params.dto.js';
import { DefineAppointmentTypeBody } from '@/contexts/scheduling/presentation/http/define-appointment-type-body.dto.js';
import { DefineAppointmentTypeAccepted } from '@/contexts/scheduling/presentation/http/define-appointment-type-accepted.dto.js';

const params = classSchema(DefineAppointmentTypeParams);
const body = classSchema(DefineAppointmentTypeBody);
const accepted = classSchema(DefineAppointmentTypeAccepted);

export function defineAppointmentTypeRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/calendars/:calendarId/appointment-types',
      operationId: 'defineAppointmentType',
      summary: 'Define appointment type',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_CALENDAR', 'INVALID_APPOINTMENT_TYPE'],
      security: ['bearer'],
    },
    async (input) => {
      const { name, duration, grid, buffer, needsConfirmation } = input.body;
      const facts = { name, duration, grid, buffer, needsConfirmation };

      const id = await commands.execute(
        new DefineAppointmentTypeCommand(actorOf(input.context.principal), input.params.calendarId, facts),
      );

      return { status: 201, body: { id } };
    },
  );
}
